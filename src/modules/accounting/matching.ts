/**
 * 3-way match: vendor invoice  ↔  purchase order  ↔  goods received (Business Central).
 * Pure function — the same logic will run server-side in production.
 */
import type {
  AccountingSettings,
  BcPurchaseOrder,
  Check,
  CheckLevel,
  Invoice,
  LineMatch,
  MatchResult,
} from './types';

const worst = (levels: CheckLevel[]): CheckLevel =>
  levels.includes('fail') ? 'fail' : levels.includes('warn') ? 'warn' : 'ok';

const round2 = (n: number) => Math.round(n * 100) / 100;

export function matchInvoice(
  inv: Invoice,
  po: BcPurchaseOrder | undefined,
  settings: AccountingSettings,
): MatchResult {
  const header: Check[] = [];
  const at = new Date().toISOString();

  if (!po) {
    header.push({
      code: 'po.missing',
      level: 'fail',
      message: {
        fr: `Bon de commande « ${inv.poNo || '—'} » introuvable dans Business Central.`,
        en: `Purchase order "${inv.poNo || '—'}" not found in Business Central.`,
      },
    });
    return { at, level: 'fail', poFound: false, header, lines: [] };
  }

  header.push({
    code: 'po.found',
    level: 'ok',
    message: { fr: `Bon de commande ${po.no} trouvé.`, en: `Purchase order ${po.no} found.` },
  });

  if (po.status !== 'Released') {
    header.push({
      code: 'po.status',
      level: po.status === 'Closed' ? 'fail' : 'warn',
      message: {
        fr: `Statut du BC : ${po.status} (attendu : Released).`,
        en: `PO status is ${po.status} (expected Released).`,
      },
    });
  }

  if (inv.vendorNo && inv.vendorNo !== po.vendorNo) {
    header.push({
      code: 'vendor.mismatch',
      level: 'fail',
      message: {
        fr: `Le fournisseur de la facture (${inv.vendorName}) ne correspond pas au BC (${po.vendorName}).`,
        en: `Invoice vendor (${inv.vendorName}) does not match PO vendor (${po.vendorName}).`,
      },
    });
  } else {
    header.push({
      code: 'vendor.ok',
      level: 'ok',
      message: { fr: `Fournisseur confirmé : ${po.vendorName}.`, en: `Vendor confirmed: ${po.vendorName}.` },
    });
  }

  if (inv.currency !== po.currency) {
    header.push({
      code: 'currency',
      level: 'fail',
      message: {
        fr: `Devise ${inv.currency} ≠ devise du BC ${po.currency}.`,
        en: `Currency ${inv.currency} ≠ PO currency ${po.currency}.`,
      },
    });
  }

  const computed = round2(inv.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
  if (Math.abs(computed - inv.subtotal) > settings.totalTolerance) {
    header.push({
      code: 'subtotal',
      level: 'warn',
      message: {
        fr: `Sous-total de la facture (${inv.subtotal.toFixed(2)}) ≠ somme des lignes (${computed.toFixed(2)}).`,
        en: `Invoice subtotal (${inv.subtotal.toFixed(2)}) ≠ sum of lines (${computed.toFixed(2)}).`,
      },
    });
  }

  const usedPoLines = new Set<number>();
  const lines: LineMatch[] = inv.lines.map((il) => {
    const checks: Check[] = [];
    const pl =
      po.lines.find((l) => !usedPoLines.has(l.lineNo) && l.itemNo && l.itemNo === il.itemNo) ??
      po.lines.find(
        (l) => !usedPoLines.has(l.lineNo) && l.description.toLowerCase() === il.description.toLowerCase(),
      );

    if (!pl) {
      checks.push({
        code: 'line.unmatched',
        level: 'fail',
        message: {
          fr: `Article ${il.itemNo || il.description} absent du bon de commande.`,
          en: `Item ${il.itemNo || il.description} is not on the purchase order.`,
        },
      });
      return { invoiceLineId: il.id, level: 'fail', checks };
    }
    usedPoLines.add(pl.lineNo);

    const available = pl.quantityReceived - pl.quantityInvoiced;
    if (il.quantity > available + settings.qtyTolerance) {
      checks.push({
        code: 'line.qty.received',
        level: 'fail',
        message: {
          fr: `Qté facturée ${il.quantity} > qté reçue non facturée ${available} (reçu ${pl.quantityReceived}, déjà facturé ${pl.quantityInvoiced}).`,
          en: `Invoiced qty ${il.quantity} > received not-yet-invoiced qty ${available} (received ${pl.quantityReceived}, already invoiced ${pl.quantityInvoiced}).`,
        },
      });
    } else if (il.quantity < available) {
      checks.push({
        code: 'line.qty.partial',
        level: 'ok',
        message: {
          fr: `Facturation partielle : ${il.quantity} de ${available} disponibles.`,
          en: `Partial billing: ${il.quantity} of ${available} available.`,
        },
      });
    } else {
      checks.push({
        code: 'line.qty.ok',
        level: 'ok',
        message: { fr: 'Quantité conforme à la réception.', en: 'Quantity matches receipt.' },
      });
    }

    if (il.quantity + pl.quantityInvoiced > pl.quantity) {
      checks.push({
        code: 'line.qty.ordered',
        level: 'fail',
        message: {
          fr: `Dépasse la quantité commandée (${pl.quantity}).`,
          en: `Exceeds ordered quantity (${pl.quantity}).`,
        },
      });
    }

    if (il.uom.toLowerCase() !== pl.uom.toLowerCase()) {
      checks.push({
        code: 'line.uom',
        level: 'warn',
        message: { fr: `Unité ${il.uom} ≠ ${pl.uom} au BC.`, en: `UoM ${il.uom} ≠ ${pl.uom} on PO.` },
      });
    }

    const variance = pl.directUnitCost ? ((il.unitPrice - pl.directUnitCost) / pl.directUnitCost) * 100 : 0;
    if (Math.abs(variance) > settings.priceTolerancePct) {
      checks.push({
        code: 'line.price',
        level: variance > 0 ? 'fail' : 'warn',
        message: {
          fr: `Prix ${il.unitPrice.toFixed(4)} vs ${pl.directUnitCost.toFixed(4)} au BC (${variance > 0 ? '+' : ''}${variance.toFixed(1)} %, tolérance ${settings.priceTolerancePct} %).`,
          en: `Price ${il.unitPrice.toFixed(4)} vs ${pl.directUnitCost.toFixed(4)} on PO (${variance > 0 ? '+' : ''}${variance.toFixed(1)}%, tolerance ${settings.priceTolerancePct}%).`,
        },
      });
    } else {
      checks.push({
        code: 'line.price.ok',
        level: 'ok',
        message: { fr: 'Prix conforme au BC.', en: 'Price matches PO.' },
      });
    }

    return {
      invoiceLineId: il.id,
      poLineNo: pl.lineNo,
      level: worst(checks.map((c) => c.level)),
      orderedQty: pl.quantity,
      receivedQty: pl.quantityReceived,
      alreadyInvoicedQty: pl.quantityInvoiced,
      availableQty: available,
      poUnitCost: pl.directUnitCost,
      priceVariancePct: round2(variance),
      checks,
    };
  });

  const level = worst([...header.map((h) => h.level), ...lines.map((l) => l.level)]);
  return { at, level, poFound: true, header, lines };
}
