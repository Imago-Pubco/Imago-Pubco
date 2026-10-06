/** A Microsoft 365 tenant managed from Imago (stored in the `o365.tenants` collection). */
export interface O365Tenant {
  id: string;
  name: string;
  /** Entra ID tenant id (GUID) or its initial domain (contoso.onmicrosoft.com). */
  tenantId: string;
  notes: string;
  addedAt: string;
}

export interface TenantOverview {
  displayName: string;
  defaultDomain: string;
  initialDomain: string;
  domains: string[];
  country: string;
  createdAt: string;
  userCount: number;
  licensesTotal: number;
  licensesUsed: number;
}

export interface O365User {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail: string;
  givenName: string;
  surname: string;
  jobTitle: string;
  department: string;
  officeLocation: string;
  mobilePhone: string;
  usageLocation: string;
  accountEnabled: boolean;
  /** Assigned license SKU ids. */
  licenses: string[];
  createdAt: string;
}

/** Fields accepted when creating or updating a user. */
export type O365UserInput = Pick<
  O365User,
  'displayName' | 'givenName' | 'surname' | 'jobTitle' | 'department' | 'officeLocation' | 'mobilePhone' | 'usageLocation' | 'accountEnabled'
> & { userPrincipalName?: string; password?: string };

/** Exchange mail contact (external address shown in the global address list). */
export interface O365Contact {
  id: string;
  displayName: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
}

export type O365ContactInput = Omit<O365Contact, 'id'>;

export interface O365Group {
  id: string;
  displayName: string;
  email: string;
  description: string;
}

export interface O365Member {
  id: string;
  displayName: string;
  email: string;
  type: 'user' | 'contact' | 'group' | 'other';
}

export interface O365License {
  skuId: string;
  skuPartNumber: string;
  /** Purchased and active seats. */
  total: number;
  consumed: number;
  suspended: number;
  warning: number;
}

export interface LicenseHolder {
  id: string;
  displayName: string;
  userPrincipalName: string;
  accountEnabled: boolean;
}
