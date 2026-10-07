/**
 * Invoice mailbox sync (Microsoft Graph). New messages with PDF attachments are stored in
 * the `acc.mailbox` collection; each PDF is saved in the `files` table and, when AI
 * extraction is configured, read into invoice fields.
 */
import { createHash } from 'node:crypto';
import { classifyAttachment } from '../src/modules/accounting/classify.ts';
import type { MailAttachment, MailMessage } from '../src/modules/accounting/types.ts';
import { config } from './config.ts';
import { getDoc, getMeta, insertDoc, saveFile, setMeta } from './db.ts';
import { extractInvoice } from './extract.ts';
import { HttpError, msFetch } from './ms.ts';

const SCOPE = 'https://graph.microsoft.com/.default';
const GRAPH = 'https://graph.microsoft.com/v1.0';
const MAX_PDF_BYTES = 20 * 1024 * 1024;

interface GraphMessage {
  id: string;
  subject: string;
  receivedDateTime: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  body?: { content?: string };
}
interface GraphAttachment {
  '@odata.type': string;
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline: boolean;
  contentBytes?: string;
}

const hashId = (prefix: string, s: string) => prefix + createHash('sha256').update(s).digest('hex').slice(0, 24);

function mailboxUrl() {
  return `${GRAPH}/users/${encodeURIComponent(config.graph.mailbox)}`;
}

export async function testMailbox() {
  if (!config.graph.enabled) throw new HttpError(503, 'Microsoft Graph mailbox is not configured on the server (.env).');
  const r = await msFetch(SCOPE, `${mailboxUrl()}/mailFolders/${encodeURIComponent(config.graph.folder)}?$select=displayName,totalItemCount,unreadItemCount`);
  const f = (await r.json()) as { displayName: string; totalItemCount: number; unreadItemCount: number };
  return { mailbox: config.graph.mailbox, folder: f.displayName, total: f.totalItemCount, unread: f.unreadItemCount };
}

let running: Promise<number> | undefined;

/** Pull new messages. Returns the number of messages added. Concurrent calls share one run. */
export function syncMailbox(): Promise<number> {
  running ??= doSync().finally(() => (running = undefined));
  return running;
}

async function doSync(): Promise<number> {
  if (!config.graph.enabled) throw new HttpError(503, 'Microsoft Graph mailbox is not configured on the server (.env).');
  const startedAt = new Date().toISOString();
  // Re-read the last hour on every sync (late deliveries); already-imported messages are skipped by id.
  const last = await getMeta<string>('graph.lastSync');
  const since = new Date(
    last ? Date.parse(last) - 3600_000 : Date.now() - config.graph.lookbackDays * 86400_000,
  ).toISOString();

  const filter = `receivedDateTime ge ${since} and hasAttachments eq true`;
  let url: string | undefined =
    `${mailboxUrl()}/mailFolders/${encodeURIComponent(config.graph.folder)}/messages` +
    `?$filter=${encodeURIComponent(filter)}&$orderby=receivedDateTime asc&$top=25` +
    `&$select=id,subject,receivedDateTime,from,body`;

  let added = 0;
  while (url) {
    const page = (await (
      await msFetch(SCOPE, url, { headers: { Prefer: 'outlook.body-content-type="text"' } })
    ).json()) as { value: GraphMessage[]; '@odata.nextLink'?: string };

    for (const m of page.value) {
      const id = hashId('mail_', m.id);
      if (await getDoc('acc.mailbox', id)) continue;
      const fromEmail = m.from?.emailAddress?.address ?? '';
      const attachments = await loadAttachments(m.id, fromEmail, m.subject ?? '', m.body?.content ?? '');
      if (!attachments.length) continue;
      const msg: MailMessage = {
        id,
        graphId: m.id,
        from: fromEmail,
        fromName: m.from?.emailAddress?.name ?? fromEmail,
        subject: m.subject ?? '',
        receivedAt: m.receivedDateTime,
        body: (m.body?.content ?? '').slice(0, 20_000),
        attachments,
        read: false,
      };
      await insertDoc('acc.mailbox', msg);
      added++;
      if (config.graph.markRead) {
        await msFetch(SCOPE, `${mailboxUrl()}/messages/${encodeURIComponent(m.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ isRead: true }),
        }).catch((e) => console.warn('[mailbox] could not mark as read:', e.message));
      }
    }
    url = page['@odata.nextLink'];
  }
  await setMeta('graph.lastSync', startedAt);
  return added;
}

async function loadAttachments(messageId: string, fromEmail: string, subject: string, body: string): Promise<MailAttachment[]> {
  const r = await msFetch(SCOPE, `${mailboxUrl()}/messages/${encodeURIComponent(messageId)}/attachments`);
  const list = ((await r.json()) as { value: GraphAttachment[] }).value;
  const out: MailAttachment[] = [];
  for (const a of list) {
    const isPdf = a.contentType === 'application/pdf' || a.name.toLowerCase().endsWith('.pdf');
    if (a['@odata.type'] !== '#microsoft.graph.fileAttachment' || a.isInline || !isPdf || !a.contentBytes) continue;
    if (a.size > MAX_PDF_BYTES) continue;
    const data = Buffer.from(a.contentBytes, 'base64');
    // A file called .pdf is only kept when it really is one (it is served back to the browser as a PDF).
    if (data.subarray(0, 5).toString('latin1') !== '%PDF-') continue;
    const fileId = hashId('f_', messageId + a.id);
    await saveFile(fileId, a.name, 'application/pdf', data);
    const att: MailAttachment = { name: a.name, sizeKb: Math.round(a.size / 1024), fileId, extracted: await extractInvoice(data, fromEmail) };
    // The AI's classification wins; otherwise keyword rules on the file name, subject and message.
    const c = classifyAttachment(att, { subject, body });
    out.push({ ...att, docType: c.docType, poDirection: c.poDirection, classifiedBy: c.by });
  }
  return out;
}
