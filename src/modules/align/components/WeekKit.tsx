/**
 * Shared pieces of the weekly screens (huddle, member page, weekly tasks, team):
 *   useWeekParam  the selected week, kept in the URL (?week=YYYY-MM-DD, a Monday)
 *   WeekPicker    ‹ 16 – 20 nov. 2026 › + "This week"
 *   Collapsible   a card section that can be minimized (remembered in this browser)
 *   MemberAvatar  the person's photo, or their initials
 */
import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Avatar } from '@/modules/admin/pages/Users';
import type { User } from '@/data/types';
import { shiftWeek, thisWeek, weekFromParam, weekLabel } from '../week';
import { InfoTip } from './Insight';

/** The selected week (a Monday) from ?week=, and a setter that keeps the other URL parameters. */
export function useWeekParam(): [string, (w: string) => void] {
  const [params, setParams] = useSearchParams();
  const week = weekFromParam(params.get('week'));
  const setWeek = (w: string) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (w === thisWeek()) n.delete('week');
        else n.set('week', w);
        return n;
      },
      { replace: true },
    );
  return [week, setWeek];
}

/** ‹ week › selector, Monday to Friday. */
export function WeekPicker({ week, onChange }: { week: string; onChange: (w: string) => void }) {
  const { t, lang } = useI18n();
  const current = week === thisWeek();
  return (
    <div className="align-week-picker" role="group" aria-label={t('Semaine', 'Week')}>
      <button className="btn btn-ghost btn-icon btn-sm" aria-label={t('Semaine précédente', 'Previous week')} onClick={() => onChange(shiftWeek(week, -1))}>
        <ChevronLeft size={16} />
      </button>
      <strong className="align-week-label">
        {t('Semaine du ', 'Week of ')}
        {weekLabel(week, lang)}
      </strong>
      <button className="btn btn-ghost btn-icon btn-sm" aria-label={t('Semaine suivante', 'Next week')} onClick={() => onChange(shiftWeek(week, 1))}>
        <ChevronRight size={16} />
      </button>
      {!current && (
        <button className="btn btn-sm" onClick={() => onChange(thisWeek())}>
          {t('Cette semaine', 'This week')}
        </button>
      )}
    </div>
  );
}

const CLOSED_KEY = 'imago:align:closed-sections';

function readClosed(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLOSED_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** A card section with a header that minimizes it. `id` names it for the remembered state (e.g. "huddle.rocks"). */
export function Collapsible({
  id,
  title,
  icon,
  count,
  actions,
  info,
  children,
}: {
  id: string;
  /** ⓘ next to the title: what the section shows and where its data comes from. */
  info?: { what: string; source: string };
  title: ReactNode;
  icon?: ReactNode;
  count?: number;
  /** Buttons on the right of the header (stay visible when minimized). */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(() => !readClosed().includes(id));
  const toggle = () => {
    const next = !open;
    setOpen(next);
    const closed = readClosed().filter((x) => x !== id);
    try {
      localStorage.setItem(CLOSED_KEY, JSON.stringify(next ? closed : [...closed, id]));
    } catch {
      /* storage unavailable: this session only */
    }
  };
  return (
    <section className={`card card-pad align-collapsible ${open ? 'open' : ''}`} data-section={id}>
      <div className="align-collapsible-head">
        <button className="align-collapsible-toggle" onClick={toggle} aria-expanded={open} title={open ? t('Réduire', 'Minimize') : t('Développer', 'Expand')}>
          <ChevronDown size={16} className="align-collapsible-chevron" />
          <span className="align-section-title" style={{ margin: 0 }}>
            {icon} {title}
          </span>
          {count !== undefined && <span className="badge">{count}</span>}
        </button>
        {info && <InfoTip what={info.what} source={info.source} />}
        <span style={{ flex: 1 }} />
        {actions && <div className="row row-wrap" style={{ gap: 8 }}>{actions}</div>}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            style={{ overflow: 'hidden' }}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <div className="align-collapsible-body">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** The person's profile picture, or their initials. */
export function MemberAvatar({ user, name, size = 40 }: { user?: Pick<User, 'displayName' | 'photo'>; name?: string; size?: number }) {
  return <Avatar name={user?.displayName ?? name ?? '?'} photo={user?.photo} size={size} />;
}
