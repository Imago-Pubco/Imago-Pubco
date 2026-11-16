import { Link } from 'react-router-dom';
import { Ban, CalendarX, CircleAlert, ListTodo } from 'lucide-react';
import { useI18n } from '@/i18n';
import { quarterLabel } from '../lib';
import type { Rock } from '../schemas';
import { ProgressBar } from './RockShared';

export interface RockStats {
  done: number;
  total: number;
  pct: number;
  blocked: number;
  overdue: number;
  red: number;
}

/** One Rock on the board. The whole card links to the Rock's page. */
export function RockCard({ rock, stats, ownerName }: { rock: Rock; stats: RockStats; ownerName: string }) {
  const { t } = useI18n();
  return (
    <Link to={`/align/rocks/${rock.id}`} className={`card rock-card${rock.archived ? ' is-archived' : ''}`}>
      <div className="row row-wrap" style={{ justifyContent: 'space-between' }}>
        <span className="small muted">{quarterLabel(rock.quarter)}</span>
        {rock.archived && <span className="badge">{t('Archivé', 'Archived')}</span>}
      </div>
      <h3 className="rock-card-title">{rock.title}</h3>
      {rock.description && <p className="rock-card-desc small">{rock.description}</p>}
      <div className="small muted">
        {t('Responsable', 'Owner')} : {ownerName}
      </div>
      <div className="stack" style={{ gap: 6, marginTop: 'auto' }}>
        <ProgressBar pct={stats.pct} />
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="small">{t(`${stats.done} / ${stats.total} priorités terminées`, `${stats.done} / ${stats.total} priorities completed`)}</span>
          <strong>{stats.pct} %</strong>
        </div>
      </div>
      {(stats.blocked > 0 || stats.overdue > 0 || stats.red > 0) && (
        <div className="rock-card-stats">
          {stats.blocked > 0 && (
            <span className="badge badge-warn">
              <Ban size={12} /> {t(`${stats.blocked} bloquée(s)`, `${stats.blocked} blocked`)}
            </span>
          )}
          {stats.overdue > 0 && (
            <span className="badge badge-err">
              <CalendarX size={12} /> {t(`${stats.overdue} en retard`, `${stats.overdue} overdue`)}
            </span>
          )}
          {stats.red > 0 && (
            <span className="badge badge-err">
              <CircleAlert size={12} /> {t(`${stats.red} santé rouge`, `${stats.red} red health`)}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

/** Last card of the board: the priorities of the quarter that are not attached to a Rock yet. */
export function RockUnlinkedCard({ count, onOpen }: { count: number; onOpen: () => void }) {
  const { t } = useI18n();
  return (
    <button type="button" className="card rock-card rock-unlinked" onClick={onOpen}>
      <div className="row" style={{ gap: 8 }}>
        <ListTodo size={18} />
        <h3 className="rock-card-title">{t('Priorités non rattachées', 'Unlinked priorities')}</h3>
      </div>
      <p className="rock-card-desc small">
        {t(
          'Priorités du trimestre qui ne sont liées à aucun Rock. Rattachez-les pour qu’elles comptent dans la progression.',
          'Priorities of the quarter not linked to any Rock. Link them so they count toward progress.',
        )}
      </p>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 'auto' }}>
        <span className="small muted">{t('À rattacher', 'To link')}</span>
        <strong>{count}</strong>
      </div>
    </button>
  );
}
