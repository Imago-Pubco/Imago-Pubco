/**
 * Explanations and drill-downs:
 *   InfoTip            ⓘ next to a section title: what the section shows and where its data comes from (hover / focus)
 *   HoverList          wraps a number or bar: hovering lists the items behind it; clicking opens the details window
 *   PriorityListModal  the details window: one line per priority (person, Rock, status, health, progress, due, blocked by)
 */
import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Modal } from '@/components/ui';
import { HEALTH_LABEL, STATUS_LABEL, isBlocked, isOverdue, priorityPct } from '../lib';
import type { AlignPriority, Rock } from '../schemas';
import { HealthDot, ProgressBar } from './RockShared';
import { fmtDay } from '../huddles/huddleLib';

/** ⓘ with a small card: what this shows, and where the data comes from. */
export function InfoTip({ what, source }: { what: string; source: string }) {
  const { t } = useI18n();
  return (
    <span className="align-info" tabIndex={0} aria-label={`${what} ${t('Données', 'Data')} : ${source}`} onClick={(e) => e.stopPropagation()}>
      <Info size={14} />
      <span className="align-info-pop" role="tooltip">
        <span className="align-info-what">{what}</span>
        <span className="align-info-src">
          <strong>{t('Données', 'Data')} :</strong> {source}
        </span>
      </span>
    </span>
  );
}

export interface HoverItem {
  key: string;
  label: string;
  meta?: string;
  dot?: string;
}

/** Hover: the first items behind a figure. Click: `onOpen` (the details window). */
export function HoverList({
  items,
  title,
  onOpen,
  children,
  className = '',
  max = 8,
  style,
}: {
  style?: CSSProperties;
  items: HoverItem[];
  title: string;
  onOpen?: () => void;
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const { t } = useI18n();
  return (
    <div
      className={`align-hover ${onOpen ? 'is-clickable' : ''} ${className}`}
      style={style}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (onOpen && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      {children}
      <div className="align-hover-pop" role="tooltip">
        <div className="align-hover-title">{title}</div>
        {items.length === 0 ? (
          <div className="small muted">{t('Aucun élément', 'Nothing here')}</div>
        ) : (
          <ul>
            {items.slice(0, max).map((i) => (
              <li key={i.key}>
                {i.dot && <span className="align-dash-dot" style={{ background: i.dot }} />}
                <span className="align-hover-label">{i.label}</span>
                {i.meta && <span className="align-hover-meta">{i.meta}</span>}
              </li>
            ))}
          </ul>
        )}
        {items.length > max && <div className="small muted">+ {items.length - max} {t('autre(s)', 'more')}</div>}
        {onOpen && <div className="align-hover-hint">{t('Cliquer pour le détail', 'Click for details')}</div>}
      </div>
    </div>
  );
}

/** Details window: the priorities behind a figure. */
export function PriorityListModal({
  title,
  subtitle,
  items,
  rockById,
  prioById,
  nameOf,
  onClose,
}: {
  title: string;
  subtitle?: string;
  items: AlignPriority[];
  rockById: Map<string, Rock>;
  prioById: Map<string, AlignPriority>;
  nameOf: (id?: string | null) => string;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  return (
    <Modal open onClose={onClose} title={title} large footer={<button className="btn" onClick={onClose}>{t('Fermer', 'Close')}</button>}>
      {subtitle && <p className="small muted" style={{ marginTop: 0 }}>{subtitle}</p>}
      {items.length === 0 ? (
        <div className="small muted">{t('Aucune priorité.', 'No priority.')}</div>
      ) : (
        <div className="table-wrap">
          <table className="table align-prio-table">
            <thead>
              <tr>
                <th>{t('Personne', 'Person')}</th>
                <th>{t('Priorité', 'Priority')}</th>
                <th>Rock</th>
                <th>{t('Statut', 'Status')}</th>
                <th>{t('Avancement', 'Progress')}</th>
                <th>{t('Échéance', 'Due')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const pct = priorityPct(p);
                const blocked = isBlocked(p, prioById);
                const blocker = p.blockedById ? prioById.get(p.blockedById) : undefined;
                const overdue = isOverdue(p);
                return (
                  <tr key={p.id}>
                    <td>
                      {p.ownerId ? (
                        <Link to={`/align/team/${p.ownerId}`} onClick={onClose}>
                          {nameOf(p.ownerId)}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="align-prio-title" title={p.title}>
                      {p.title}
                      {blocked && (
                        <div className="small" style={{ color: 'var(--warn)', fontWeight: 500, whiteSpace: 'normal' }}>
                          {t('Bloquée par', 'Blocked by')} : {blocker?.title ?? '—'}
                          {blocker?.ownerId ? ` (${nameOf(blocker.ownerId)})` : ''}
                          {p.blockedNote ? ` — ${p.blockedNote}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="align-prio-rock small muted" title={p.rockId ? rockById.get(p.rockId)?.title : undefined}>
                      {p.rockId ? (
                        <Link to={`/align/rocks/${p.rockId}`} onClick={onClose}>
                          {rockById.get(p.rockId)?.title ?? '—'}
                        </Link>
                      ) : (
                        t('Sans Rock', 'No Rock')
                      )}
                    </td>
                    <td className="small align-nowrap" title={t(HEALTH_LABEL[p.health])}>
                      <HealthDot health={p.health} /> {t(STATUS_LABEL[p.status])}
                    </td>
                    <td className="align-nowrap">
                      <ProgressBar pct={pct} style={{ width: 56, display: 'inline-block', verticalAlign: 'middle' }} /> <span className="small mono">{pct} %</span>
                    </td>
                    <td className="small align-nowrap" style={overdue ? { color: 'var(--err)', fontWeight: 600 } : undefined}>
                      {p.dueDate ? fmtDay(p.dueDate, lang) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

/** Hover lines for priorities: title + person. */
export const prioItems = (list: AlignPriority[], nameOf: (id?: string | null) => string, color?: (p: AlignPriority) => string): HoverItem[] =>
  list.map((p) => ({ key: p.id, label: p.title, meta: nameOf(p.ownerId), dot: color?.(p) }));

/** A details window state: which list is open. */
export function useDrill<T>() {
  return useState<T | null>(null);
}
