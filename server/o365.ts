/**
 * Microsoft 365 management for the "Gestion O365" module.
 *  - Users, licenses, organisation: Microsoft Graph v1.0.
 *  - Mail contacts and distribution groups: Exchange Online admin API (InvokeCommand),
 *    because Graph cannot create mail contacts or change distribution-list members.
 * One multi-tenant app registration (O365_CLIENT_ID/SECRET) signs in to each managed tenant.
 */
import type {
  LicenseHolder,
  O365Contact,
  O365ContactInput,
  O365Group,
  O365License,
  O365Member,
  O365User,
  O365UserInput,
  TenantOverview,
} from '../src/modules/o365/types.ts';
import { config } from './config.ts';
import { HttpError, msFetch, type MsAuth } from './ms.ts';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';
const EXO_SCOPE = 'https://outlook.office365.com/.default';
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertO365() {
  if (!config.o365.enabled) throw new HttpError(503, 'Microsoft 365 management is not configured on the server (O365_CLIENT_ID / O365_CLIENT_SECRET in .env).');
}

const auth = (tenantId: string): MsAuth => ({ tenantId, clientId: config.o365.clientId, clientSecret: config.o365.clientSecret });

export function requireGuid(value: string, what: string) {
  if (!GUID.test(value)) throw new HttpError(400, `Invalid ${what}.`);
  return value;
}

/* ---------- Graph ---------- */

async function graph<T>(tenantId: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await msFetch(GRAPH_SCOPE, path.startsWith('https://') ? path : GRAPH + path, init, auth(tenantId));
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Follows @odata.nextLink pages (capped to protect the server on very large tenants). */
async function graphAll<T>(tenantId: string, path: string, headers: Record<string, string> = {}, max = 20_000): Promise<T[]> {
  const out: T[] = [];
  let url: string | undefined = path;
  while (url && out.length < max) {
    const page: { value: T[]; '@odata.nextLink'?: string } = await graph(tenantId, url, { headers });
    out.push(...page.value);
    url = page['@odata.nextLink'];
  }
  return out;
}

const domainCache = new Map<string, string>();

interface RawOrg {
  displayName: string;
  countryLetterCode: string;
  createdDateTime: string;
  verifiedDomains: { name: string; isDefault: boolean; isInitial: boolean }[];
}

async function organization(tenantId: string): Promise<RawOrg> {
  const r = await graph<{ value: RawOrg[] }>(tenantId, '/organization?$select=displayName,countryLetterCode,createdDateTime,verifiedDomains');
  const org = r.value[0];
  const initial = org.verifiedDomains.find((d) => d.isInitial)?.name;
  if (initial) domainCache.set(tenantId, initial);
  return org;
}

async function initialDomain(tenantId: string) {
  return domainCache.get(tenantId) ?? organization(tenantId).then(() => domainCache.get(tenantId) ?? tenantId);
}

interface RawSku {
  skuId: string;
  skuPartNumber: string;
  capabilityStatus: string;
  consumedUnits: number;
  prepaidUnits: { enabled: number; suspended: number; warning: number };
}

/** SKUs Microsoft hands out at no cost (free, viral, exploratory, developer or resource-account licenses). */
const FREE_SKU = /FREE|VIRAL|EXPLORATORY|DEVELOPERPACK|POWERAPPS_DEV|WINDOWS_STORE|POWER_BI_STANDARD|PHONESYSTEM_VIRTUALUSER|MICROSOFT_BUSINESS_CENTER|STREAM$|RMSBASIC|TRIAL/i;

/** Graph does not flag paid SKUs, so: not a known free SKU, a real seat count (free pools are 10 000+), and active. */
function isPaidSku(s: RawSku): boolean {
  return s.capabilityStatus === 'Enabled' && !FREE_SKU.test(s.skuPartNumber) && s.prepaidUnits.enabled > 0 && s.prepaidUnits.enabled < 10_000;
}

export async function listLicenses(tenantId: string, paidOnly = false): Promise<O365License[]> {
  const r = await graph<{ value: RawSku[] }>(tenantId, '/subscribedSkus');
  return r.value
    .filter((s) => (paidOnly ? isPaidSku(s) : s.prepaidUnits.enabled > 0 || s.consumedUnits > 0))
    .map((s) => ({
      skuId: s.skuId,
      skuPartNumber: s.skuPartNumber,
      total: s.prepaidUnits.enabled,
      consumed: s.consumedUnits,
      suspended: s.prepaidUnits.suspended,
      warning: s.prepaidUnits.warning,
    }));
}

export async function overview(tenantId: string): Promise<TenantOverview> {
  const [org, count, skus] = await Promise.all([
    organization(tenantId),
    msFetch(GRAPH_SCOPE, `${GRAPH}/users/$count`, { headers: { ConsistencyLevel: 'eventual', Accept: 'text/plain' } }, auth(tenantId)).then((r) => r.text()),
    listLicenses(tenantId),
  ]);
  return {
    displayName: org.displayName,
    defaultDomain: org.verifiedDomains.find((d) => d.isDefault)?.name ?? '',
    initialDomain: org.verifiedDomains.find((d) => d.isInitial)?.name ?? '',
    domains: org.verifiedDomains.map((d) => d.name).sort(),
    country: org.countryLetterCode,
    createdAt: org.createdDateTime,
    userCount: Number(count) || 0,
    licensesTotal: skus.reduce((s, l) => s + l.total, 0),
    licensesUsed: skus.reduce((s, l) => s + l.consumed, 0),
  };
}

const USER_FIELDS =
  'id,displayName,userPrincipalName,mail,givenName,surname,jobTitle,department,officeLocation,mobilePhone,usageLocation,accountEnabled,assignedLicenses,createdDateTime';

interface RawUser {
  id: string;
  displayName: string | null;
  userPrincipalName: string;
  mail: string | null;
  givenName: string | null;
  surname: string | null;
  jobTitle: string | null;
  department: string | null;
  officeLocation: string | null;
  mobilePhone: string | null;
  usageLocation: string | null;
  accountEnabled: boolean;
  assignedLicenses: { skuId: string }[];
  createdDateTime: string;
}

const mapUser = (u: RawUser): O365User => ({
  id: u.id,
  displayName: u.displayName ?? '',
  userPrincipalName: u.userPrincipalName,
  mail: u.mail ?? '',
  givenName: u.givenName ?? '',
  surname: u.surname ?? '',
  jobTitle: u.jobTitle ?? '',
  department: u.department ?? '',
  officeLocation: u.officeLocation ?? '',
  mobilePhone: u.mobilePhone ?? '',
  usageLocation: u.usageLocation ?? '',
  accountEnabled: u.accountEnabled,
  licenses: (u.assignedLicenses ?? []).map((l) => l.skuId),
  createdAt: u.createdDateTime,
});

export async function listUsers(tenantId: string): Promise<O365User[]> {
  return (await graphAll<RawUser>(tenantId, `/users?$select=${USER_FIELDS}&$top=999`)).map(mapUser);
}

const EDITABLE = ['displayName', 'givenName', 'surname', 'jobTitle', 'department', 'officeLocation', 'mobilePhone', 'usageLocation'] as const;

/** Graph rejects empty strings on most profile fields: send null to clear a value. */
function profile(input: Partial<O365UserInput>, forCreate: boolean) {
  const out: Record<string, unknown> = {};
  for (const k of EDITABLE) {
    if (input[k] === undefined) continue;
    const v = String(input[k]).trim();
    if (v) out[k] = v;
    else if (!forCreate) out[k] = null;
  }
  if (typeof input.accountEnabled === 'boolean') out.accountEnabled = input.accountEnabled;
  return out;
}

export async function createUser(tenantId: string, input: O365UserInput & { userPrincipalName: string; password: string }) {
  const upn = String(input.userPrincipalName).trim().toLowerCase();
  const alias = upn.split('@')[0];
  if (!/^[a-z0-9._'-]+@[a-z0-9.-]+$/i.test(upn)) throw new HttpError(400, 'Invalid username.');
  const raw = await graph<RawUser>(tenantId, '/users', {
    method: 'POST',
    body: JSON.stringify({
      ...profile(input, true),
      accountEnabled: input.accountEnabled ?? true,
      displayName: String(input.displayName || alias).trim(),
      userPrincipalName: upn,
      mailNickname: alias.replace(/[^a-z0-9._-]/gi, ''),
      passwordProfile: { password: input.password, forceChangePasswordNextSignIn: true },
    }),
  });
  return mapUser({ ...raw, assignedLicenses: [] });
}

export async function updateUser(tenantId: string, id: string, input: Partial<O365UserInput>) {
  await graph(tenantId, `/users/${requireGuid(id, 'user id')}`, { method: 'PATCH', body: JSON.stringify(profile(input, false)) });
}

export async function resetPassword(tenantId: string, id: string, password: string, forceChange: boolean) {
  await graph(tenantId, `/users/${requireGuid(id, 'user id')}`, {
    method: 'PATCH',
    body: JSON.stringify({ passwordProfile: { password, forceChangePasswordNextSignIn: forceChange } }),
  });
}

export async function deleteUser(tenantId: string, id: string) {
  await graph(tenantId, `/users/${requireGuid(id, 'user id')}`, { method: 'DELETE' });
}

export async function setLicenses(tenantId: string, id: string, add: string[], remove: string[]) {
  await graph(tenantId, `/users/${requireGuid(id, 'user id')}/assignLicense`, {
    method: 'POST',
    body: JSON.stringify({
      addLicenses: add.map((skuId) => ({ skuId: requireGuid(skuId, 'license'), disabledPlans: [] })),
      removeLicenses: remove.map((skuId) => requireGuid(skuId, 'license')),
    }),
  });
}

export async function licenseHolders(tenantId: string, skuId: string): Promise<LicenseHolder[]> {
  requireGuid(skuId, 'license');
  const filter = encodeURIComponent(`assignedLicenses/any(x:x/skuId eq ${skuId})`);
  const rows = await graphAll<{ id: string; displayName: string | null; userPrincipalName: string; accountEnabled: boolean }>(
    tenantId,
    `/users?$filter=${filter}&$select=id,displayName,userPrincipalName,accountEnabled&$count=true&$top=999`,
    { ConsistencyLevel: 'eventual' },
  );
  return rows.map((u) => ({ id: u.id, displayName: u.displayName ?? u.userPrincipalName, userPrincipalName: u.userPrincipalName, accountEnabled: u.accountEnabled }));
}

/* ---------- Exchange Online (admin API) ---------- */

async function exo<T = Record<string, unknown>>(tenantId: string, cmdlet: string, parameters: Record<string, unknown> = {}): Promise<T[]> {
  const domain = await initialDomain(tenantId);
  const out: T[] = [];
  let url: string | undefined = `https://outlook.office365.com/adminapi/beta/${encodeURIComponent(tenantId)}/InvokeCommand`;
  const body = JSON.stringify({ CmdletInput: { CmdletName: cmdlet, Parameters: parameters } });
  while (url) {
    const res = await msFetch(
      EXO_SCOPE,
      url,
      {
        method: 'POST',
        body,
        headers: {
          'X-AnchorMailbox': `UPN:SystemMailbox{bb558c35-97f1-4cb9-8ff7-d53741dc928c}@${domain}`,
          // The Exchange admin API can send gzip that undici fails to inflate (Z_DATA_ERROR "incorrect header check").
          'Accept-Encoding': 'identity',
        },
      },
      auth(tenantId),
    ).catch((e: unknown) => {
      if (e instanceof HttpError) {
        // Surface the cmdlet's own error message (e.g. "already a member").
        try {
          const j = JSON.parse(e.body) as { error?: { details?: { message?: string }[]; message?: string } };
          const msg = j.error?.details?.[0]?.message ?? j.error?.message;
          if (msg) throw new HttpError(e.status, msg.replace(/^\|[^|]*\|/, '').trim(), e.body);
        } catch (inner) {
          if (inner instanceof HttpError) throw inner;
        }
      }
      throw e;
    });
    const text = await res.text();
    const page = (text ? JSON.parse(text) : {}) as { value?: T[]; '@odata.nextLink'?: string };
    out.push(...(page.value ?? []));
    url = page['@odata.nextLink'];
  }
  return out;
}

const smtp = (v: unknown) => String(v ?? '').replace(/^smtp:/i, '');
const text = (v: unknown) => (Array.isArray(v) ? v.join(' ') : String(v ?? ''));

export async function listContacts(tenantId: string): Promise<O365Contact[]> {
  const [mail, details] = await Promise.all([
    exo<{ Guid: string; Identity: string; DisplayName: string; ExternalEmailAddress: string; PrimarySmtpAddress: string }>(tenantId, 'Get-MailContact', {
      ResultSize: 'Unlimited',
    }),
    // First/last name and company live on the contact object; ignore if unavailable.
    exo<{ Identity: string; FirstName: string; LastName: string; Company: string }>(tenantId, 'Get-Contact', {
      RecipientTypeDetails: 'MailContact',
      ResultSize: 'Unlimited',
    }).catch(() => []),
  ]);
  const byIdentity = new Map(details.map((d) => [d.Identity, d]));
  return mail.map((c) => {
    const d = byIdentity.get(c.Identity);
    return {
      id: c.Guid,
      displayName: c.DisplayName,
      email: smtp(c.ExternalEmailAddress) || c.PrimarySmtpAddress,
      firstName: d?.FirstName ?? '',
      lastName: d?.LastName ?? '',
      company: d?.Company ?? '',
    };
  });
}

export async function createContact(tenantId: string, input: O365ContactInput) {
  const email = String(input.email).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Invalid e-mail address.');
  const displayName = String(input.displayName || email).trim();
  const params: Record<string, unknown> = { Name: displayName, DisplayName: displayName, ExternalEmailAddress: email };
  if (input.firstName?.trim()) params.FirstName = input.firstName.trim();
  if (input.lastName?.trim()) params.LastName = input.lastName.trim();
  const [created] = await exo<{ Guid: string }>(tenantId, 'New-MailContact', params);
  if (input.company?.trim() && created?.Guid) {
    await exo(tenantId, 'Set-Contact', { Identity: created.Guid, Company: input.company.trim() });
  }
}

/** Updates display name and external address (mail contact) and first/last name and company (contact). */
export async function updateContact(tenantId: string, id: string, input: Partial<O365ContactInput>) {
  requireGuid(id, 'contact id');
  const mail: Record<string, unknown> = {};
  if (input.displayName !== undefined) {
    const displayName = String(input.displayName).trim();
    if (!displayName) throw new HttpError(400, 'Display name is required.');
    mail.DisplayName = displayName;
  }
  if (input.email !== undefined) {
    const email = String(input.email).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Invalid e-mail address.');
    mail.ExternalEmailAddress = email;
  }
  if (Object.keys(mail).length) await exo(tenantId, 'Set-MailContact', { Identity: id, ...mail });

  // Empty values clear the field (sent as null).
  const contact: Record<string, unknown> = {};
  const clear = (v: unknown) => String(v ?? '').trim() || null;
  if (input.firstName !== undefined) contact.FirstName = clear(input.firstName);
  if (input.lastName !== undefined) contact.LastName = clear(input.lastName);
  if (input.company !== undefined) contact.Company = clear(input.company);
  if (Object.keys(contact).length) await exo(tenantId, 'Set-Contact', { Identity: id, ...contact });
}

export async function deleteContact(tenantId: string, id: string) {
  await exo(tenantId, 'Remove-MailContact', { Identity: requireGuid(id, 'contact id'), Confirm: false });
}

export async function listGroups(tenantId: string): Promise<O365Group[]> {
  const rows = await exo<{ Guid: string; DisplayName: string; PrimarySmtpAddress: string; Description: unknown }>(tenantId, 'Get-DistributionGroup', {
    ResultSize: 'Unlimited',
  });
  return rows.map((g) => ({ id: g.Guid, displayName: g.DisplayName, email: g.PrimarySmtpAddress, description: text(g.Description) }));
}

const memberType = (recipientType: string): O365Member['type'] =>
  /contact/i.test(recipientType) ? 'contact' : /group/i.test(recipientType) ? 'group' : /mailbox|user/i.test(recipientType) ? 'user' : 'other';

export async function listMembers(tenantId: string, groupId: string): Promise<O365Member[]> {
  const rows = await exo<{ Guid: string; DisplayName: string; PrimarySmtpAddress: string; RecipientType: string }>(tenantId, 'Get-DistributionGroupMember', {
    Identity: requireGuid(groupId, 'group id'),
    ResultSize: 'Unlimited',
  });
  return rows.map((m) => ({ id: m.Guid, displayName: m.DisplayName, email: m.PrimarySmtpAddress, type: memberType(m.RecipientType) }));
}

export async function addMember(tenantId: string, groupId: string, email: string) {
  const member = String(email).trim();
  if (!member.includes('@')) throw new HttpError(400, 'Enter the e-mail address of a user or contact.');
  await exo(tenantId, 'Add-DistributionGroupMember', {
    Identity: requireGuid(groupId, 'group id'),
    Member: member,
    BypassSecurityGroupManagerCheck: true,
  });
}

export async function removeMember(tenantId: string, groupId: string, memberId: string) {
  await exo(tenantId, 'Remove-DistributionGroupMember', {
    Identity: requireGuid(groupId, 'group id'),
    Member: requireGuid(memberId, 'member id'),
    BypassSecurityGroupManagerCheck: true,
    Confirm: false,
  });
}
