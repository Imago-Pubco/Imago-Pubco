import { useState } from 'react';
import { Pencil, Plus, Receipt, Trash2 } from 'lucide-react';
import { uid } from '@/data/db';
import { useI18n } from '@/i18n';
import { Empty, Modal, useToast } from '@/components/ui';
import { expenseFee, fmtMoney, iso, sum } from './lib';
import type { Expense, Project } from './schemas';
import { expenses } from './stores';
import { Badge } from './ProjectDetail.ui';

/** Expenses of the project (cost, markup, billable). Managers add, edit and delete them. */
export function ExpensesTab({ project, items, canManage }: { project: Project; items: Expense[]; canManage: boolean }) {
  const { t, lang } = useI18n();
  const notify = useToast();
  const [modal, setModal] = useState<{ expense?: Expense } | null>(null);

  const remove = async (x: Expense) => {
    if (!window.confirm(t(`Supprimer la dépense « ${x.description} » ?`, `Delete the expense “${x.description}”?`))) return;
    try {
      await expenses.remove(x.id);
    } catch (e) {
      notify((e as Error).message, 'err');
    }
  };

  const totalCost = sum(items.map((x) => x.cost));
  const totalFee = sum(items.map(expenseFee));
  const colCount = canManage ? 8 : 7;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row row-wrap" style={{ alignItems: 'center' }}>
        <div className="spacer" />
        {canManage && (
          <button className="btn btn-primary" onClick={() => setModal({})}>
            <Plus size={16} /> {t('Dépense', 'Expense')}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card">
          <Empty icon={<Receipt size={40} />} title={t('Aucune dépense sur ce projet', 'No expenses on this project')}>
            {canManage ? t('Ajoutez une dépense externe (sous-traitant, achat, déplacement).', 'Add an external cost (subcontractor, purchase, travel).') : null}
          </Empty>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('Date', 'Date')}</th>
                <th>{t('Description', 'Description')}</th>
                <th>{t('Fournisseur', 'Vendor')}</th>
                <th className="num">{t('Coût', 'Cost')}</th>
                <th className="num">{t('Marge %', 'Markup %')}</th>
                <th className="num">{t('Montant facturé', 'Billed amount')}</th>
                <th>{t('Facturable', 'Billable')}</th>
                {canManage && <th aria-label={t('Actions', 'Actions')} />}
              </tr>
            </thead>
            <tbody>
              {items.map((x) => (
                <tr key={x.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{x.date}</td>
                  <td>{x.description}</td>
                  <td className="small">{x.vendor || '—'}</td>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>
                    {fmtMoney(x.cost, lang)}
                  </td>
                  <td className="num">{x.markupPct} %</td>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>
                    {x.billable ? fmtMoney(expenseFee(x), lang) : '—'}
                  </td>
                  <td>
                    <Badge className={x.billable ? 'badge-ok' : ''}>{x.billable ? t('Oui', 'Yes') : t('Non', 'No')}</Badge>
                  </td>
                  {canManage && (
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost btn-icon btn-sm" aria-label={t('Modifier la dépense', 'Edit expense')} onClick={() => setModal({ expense: x })}>
                        <Pencil size={16} />
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm" aria-label={t('Supprimer la dépense', 'Delete expense')} onClick={() => remove(x)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 600 }}>
                <td colSpan={3}>{t('Total', 'Total')}</td>
                <td className="num">{fmtMoney(totalCost, lang)}</td>
                <td />
                <td className="num">{fmtMoney(totalFee, lang)}</td>
                <td colSpan={colCount - 6} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {modal && <ExpenseModal projectId={project.id} expense={modal.expense} onClose={() => setModal(null)} />}
    </div>
  );
}

interface Draft {
  date: string;
  description: string;
  vendor: string;
  cost: string;
  markupPct: string;
  billable: boolean;
}

function ExpenseModal({ projectId, expense, onClose }: { projectId: string; expense?: Expense; onClose: () => void }) {
  const { t } = useI18n();
  const notify = useToast();
  const [d, setD] = useState<Draft>(() =>
    expense
      ? { date: expense.date, description: expense.description, vendor: expense.vendor, cost: String(expense.cost), markupPct: String(expense.markupPct), billable: expense.billable }
      : { date: iso(new Date()), description: '', vendor: '', cost: '', markupPct: '0', billable: true },
  );
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const cost = Number(d.cost);
    const markupPct = Number(d.markupPct);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return notify(t('Indiquez la date.', 'Enter the date.'), 'err');
    if (!d.description.trim()) return notify(t('Décrivez la dépense.', 'Describe the expense.'), 'err');
    if (d.cost.trim() === '' || !Number.isFinite(cost) || cost < 0) return notify(t('Le coût doit être un montant positif.', 'The cost must be a positive amount.'), 'err');
    if (d.markupPct.trim() === '' || !Number.isFinite(markupPct) || markupPct < 0 || markupPct > 1000) return notify(t('La marge doit être entre 0 et 1000 %.', 'The markup must be between 0 and 1000 %.'), 'err');

    const row = {
      projectId,
      date: d.date,
      description: d.description.trim(),
      vendor: d.vendor.trim(),
      cost,
      markupPct,
      billable: d.billable,
    };
    setBusy(true);
    try {
      if (expense) await expenses.update(expense.id, row);
      else await expenses.insert({ id: uid('x_'), ...row });
      onClose();
    } catch (e) {
      notify((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={expense ? t('Modifier la dépense', 'Edit expense') : t('Nouvelle dépense', 'New expense')}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            {t('Annuler', 'Cancel')}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {t('Enregistrer', 'Save')}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 12 }}>
        <label className="field">
          <span>{t('Date', 'Date')}</span>
          <input className="input" type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
        </label>
        <label className="field">
          <span>{t('Description', 'Description')}</span>
          <input className="input" maxLength={300} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
        </label>
        <label className="field">
          <span>{t('Fournisseur', 'Vendor')}</span>
          <input className="input" maxLength={120} value={d.vendor} onChange={(e) => setD({ ...d, vendor: e.target.value })} />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>{t('Coût', 'Cost')}</span>
            <input className="input" type="number" min={0} step="0.01" inputMode="decimal" value={d.cost} onChange={(e) => setD({ ...d, cost: e.target.value })} />
          </label>
          <label className="field">
            <span>{t('Marge %', 'Markup %')}</span>
            <input className="input" type="number" min={0} max={1000} step="0.5" inputMode="decimal" value={d.markupPct} onChange={(e) => setD({ ...d, markupPct: e.target.value })} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={d.billable} onChange={(e) => setD({ ...d, billable: e.target.checked })} />
          {t('Facturable au client', 'Billable to the client')}
        </label>
      </div>
    </Modal>
  );
}
