import { useMemo, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { Kanban, List as ListIcon } from 'lucide-react';
import { useCollection } from '@/data/db';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, PageHeader, useToast } from '@/components/ui';
import { useUsers, Avatar, DueDate, ProgressBar, WoStatusBadge } from '../ui';
import { workOrders, changeWorkOrder } from '../stores';
import { WO_STATUSES, WO_STATUS_LABEL, isOverdue, isOpen, type WorkOrder, type WorkOrderStatus } from '../types';

export function Board() {
  const { t, fmtMoney, fmtNum } = useI18n();
  const { user, can } = useAuth();
  const toast = useToast();
  const { rows, loading } = useCollection(workOrders);
  const { byId } = useUsers();
  const canManage = can('workorders.manage');
  const [over, setOver] = useState<WorkOrderStatus | null>(null);

  const columns = useMemo(() => {
    const map = new Map<WorkOrderStatus, WorkOrder[]>(WO_STATUSES.map((s) => [s, []]));
    rows.forEach((wo) => map.get(wo.status)?.push(wo));
    map.forEach((list) => list.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')));
    return map;
  }, [rows]);

  async function move(wo: WorkOrder, to: WorkOrderStatus) {
    if (!canManage || wo.status === to) return;
    try {
      await changeWorkOrder(wo, { status: to }, user?.id ?? 'system', t(`Statut : ${WO_STATUS_LABEL[to].fr}`, `Status: ${WO_STATUS_LABEL[to].en}`));
      toast(t(`${wo.no} : ${WO_STATUS_LABEL[to].fr}`, `${wo.no}: ${WO_STATUS_LABEL[to].en}`));
    } catch {
      toast(t('Impossible de déplacer la commande.', 'Could not move the order.'), 'err');
    }
  }

  const onDragOver = (e: DragEvent, s: WorkOrderStatus) => {
    if (!canManage) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (over !== s) setOver(s);
  };
  const onDrop = (e: DragEvent, s: WorkOrderStatus) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData('text/plain');
    const wo = rows.find((r) => r.id === id);
    if (wo) void move(wo, s);
  };

  if (!loading && !rows.length) {
    return (
      <Page>
        <PageHeader eyebrow={t('Production', 'Production')} title={t('Ordres de travail', 'Work orders')} />
        <div className="card">
          <Empty icon={<Kanban size={36} />} title={t('Aucun ordre de travail', 'No work orders')}>
            <span className="muted small">{t('Un ordre est créé quand une soumission acceptée passe en production.', 'An order is created when an accepted quote goes to production.')}</span>
          </Empty>
        </div>
      </Page>
    );
  }

  return (
    <Page wide>
      <PageHeader
        eyebrow={t('Production', 'Production')}
        title={t('Ordres de travail', 'Work orders')}
        subtitle={canManage ? t('Glissez une carte d’une colonne à l’autre, ou utilisez « Déplacer vers ».', 'Drag a card to another column, or use “Move to”.') : undefined}
        actions={
          <Link to="/workorders/list" className="btn">
            <ListIcon size={16} /> {t('Vue liste', 'List view')}
          </Link>
        }
      />
      <div className="wo-board" role="list" aria-label={t('Tableau des ordres de travail', 'Work order board')}>
        {WO_STATUSES.map((s) => {
          const list = columns.get(s) ?? [];
          const label = t(WO_STATUS_LABEL[s]);
          return (
            <section
              key={s}
              role="listitem"
              className={`wo-col ${over === s ? 'is-over' : ''}`}
              aria-labelledby={`wo-col-${s}`}
              onDragOver={(e) => onDragOver(e, s)}
              onDragLeave={() => over === s && setOver(null)}
              onDrop={(e) => onDrop(e, s)}
            >
              <header className="wo-col-head">
                <h2 id={`wo-col-${s}`}>{label}</h2>
                <span className="badge">{list.length}</span>
              </header>
              <div className="wo-col-body">
                {list.map((wo) => {
                  const manager = wo.managerId ? byId.get(wo.managerId) : undefined;
                  const late = isOverdue(wo);
                  return (
                    <article
                      key={wo.id}
                      className={`wo-card ${late ? 'is-overdue' : ''}`}
                      draggable={canManage}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', wo.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      aria-label={`${wo.no} — ${wo.customer}`}
                    >
                      <div className="wo-card-top">
                        <span className="mono small">{wo.no}</span>
                        <DueDate wo={wo} />
                      </div>
                      <Link to={`/workorders/${wo.id}`} className="wo-card-title">
                        {wo.customer}
                      </Link>
                      <div className="faint small wo-clamp">{wo.project}</div>
                      <div className="small muted">
                        {fmtNum(wo.quantity)} {t('ex.', 'pcs')} · {fmtMoney(wo.total)}
                      </div>
                      <ProgressBar tasks={wo.tasks} compact />
                      <div className="wo-card-foot">
                        <span className="row small muted" style={{ gap: 6, minWidth: 0 }}>
                          <Avatar user={manager} size={22} />
                          <span className="wo-clamp">{manager?.displayName ?? t('Non assigné', 'Unassigned')}</span>
                        </span>
                        {!isOpen(wo) && <WoStatusBadge status={wo.status} />}
                      </div>
                      {canManage && (
                        <label className="wo-move">
                          <span className="small faint">{t('Déplacer vers', 'Move to')}</span>
                          <select className="input wo-select" value={wo.status} onChange={(e) => void move(wo, e.target.value as WorkOrderStatus)} aria-label={t(`Déplacer ${wo.no} vers`, `Move ${wo.no} to`)}>
                            {WO_STATUSES.map((o) => (
                              <option key={o} value={o}>
                                {t(WO_STATUS_LABEL[o])}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </article>
                  );
                })}
                {!list.length && <div className="wo-col-empty">{t('Aucune commande', 'No orders')}</div>}
              </div>
            </section>
          );
        })}
      </div>
      <p className="faint small" style={{ marginTop: 12 }}>
        <Kanban size={12} style={{ verticalAlign: '-2px' }} aria-hidden /> {t('Les commandes en retard sont signalées en rouge.', 'Late orders are flagged in red.')}
      </p>
    </Page>
  );
}
