/**
 * Document classification for the invoice mailbox. A PDF is an invoice, a purchase order (bon de commande)
 * or something else. When the AI read the document its answer wins; otherwise simple keyword rules on
 * the file name, subject and message body decide. People can always correct the result in Documents.
 * Shared by the server (mailbox sync) and the screens.
 */
import type { DocType, MailAttachment, MailMessage, PoDirection } from './types';

const INVOICE = /\b(factures?|invoices?|inv[-_ ]?\d|relev[eé] de compte|statement|note de cr[eé]dit|credit memo)\b/i;
const PO = /\b(bons? de commande|purchase orders?|commande d['’]achat|order confirmation|confirmation de commande|p\.?o\.?[-_ #:]*\d|b\.?c\.?[-_ #:]*\d)/i;

export interface Classification {
  docType: DocType;
  poDirection?: PoDirection;
  by: 'ai' | 'rules' | 'user';
}

/** Which side a PO is on: our customer ordering from us, or our own PO to a vendor (confirmations, acknowledgements). */
function directionFor(text: string): PoDirection {
  return /\b(confirmation|accus[eé] de r[eé]ception|acknowledg)/i.test(text) ? 'vendor' : 'customer';
}

export function classifyByRules(att: Pick<MailAttachment, 'name'>, msg: Pick<MailMessage, 'subject' | 'body'>): Classification {
  // The file name is the strongest hint, then the subject, then the opening of the message.
  for (const text of [att.name, msg.subject, msg.body.slice(0, 600)]) {
    const inv = INVOICE.test(text);
    const po = PO.test(text);
    if (po && !inv) return { docType: 'po', poDirection: directionFor(text), by: 'rules' };
    if (inv && !po) return { docType: 'invoice', by: 'rules' };
    if (inv && po) {
      // "Facture ... PO-123" is an invoice that mentions its order; "Bon de commande ... facturer à" is a PO.
      const first = Math.min(text.search(INVOICE), text.search(PO));
      return text.search(PO) === first ? { docType: 'po', poDirection: directionFor(text), by: 'rules' } : { docType: 'invoice', by: 'rules' };
    }
  }
  return { docType: 'other', by: 'rules' };
}

/** The attachment's classification: a person's choice, then the AI's, then the rules. */
export function classifyAttachment(att: MailAttachment, msg: Pick<MailMessage, 'subject' | 'body'>): Classification {
  if (att.docType && att.classifiedBy) return { docType: att.docType, poDirection: att.poDirection, by: att.classifiedBy };
  const ai = att.extracted?.docType;
  if (ai === 'invoice' || ai === 'po' || ai === 'other') {
    return { docType: ai, poDirection: ai === 'po' ? (att.extracted?.poDirection || 'customer') : undefined, by: 'ai' };
  }
  return classifyByRules(att, msg);
}
