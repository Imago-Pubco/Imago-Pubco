import { errorText } from '../components/RockShared';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Archive, ArchiveRestore, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useCollection } from '@/data/db';
import { useUserName } from '@/data/hooks';
import { users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, PageHeader, useToast } from '@/components/ui';
import { STATUS_LABEL, isBlocked, isOverdue, priorityPct, quarterLabel, rockProgress } from '../lib';
import { alignPriorities, rocks, strategy } from '../stores';
import type { PriorityStatus } from '../schemas';
import { PriorityPanel } from '../components/PriorityPanel';
import { PriorityNewModal } from '../components/PriorityNewModal';
import { RockFormModal } from '../components/RockFormModal';
import { HealthDot, ProgressBar, StatusBadge, planFrom, sortPriorities } from '../components/RockShared';

/** One Rock: its progress, its priorities, and the actions for managers. */
export function RockDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { t, fmtDate } = useI18n();
  const { user, can } = useAuth();
  const toast = useToast();
  const userName = useUserName();
  const { rows: allRocks, loading } = useCollection(rocks);
  const { rows: allPriorities } = useCollection(alignPriorities);
  const { rows: strategyRows } = useCollection(strategy);
  const { rows: people } = useCollection(users);

  const [mineOnly, setMineOnly] = useState(false);
  const [statusF, setStatusF] = useState<PriorityStatus | ''>('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const me = user!.id;
  const rock = allRocks.find((r) => r.id === id);
  const canManage = can('align.rocks.manage');
  const canPriorities = can('align.priorities.manage');
  const plan = useMemo(() => planFrom(strategyRows), [strategyRows]);
  const thrusts = plan.keyThrusts;
  const initiatives = plan.keyInitiatives;

  const progress = useMemo(() => (rock ? rockProgress(rock, allPriorities) : null), [rock, allPriorities]);
  const byId = useMemo(() => new Map(allPriorities.map((p) => [p.id, p])), [allPriorities]);
  const linkedCount = useMemo(() => (rock ? allPriorities.filter((p) => p.rockId === rock.id).length : 0), [allPriorities, rock]);

  const rows = useMemo(() => {
    if (!rock) return [];
    return allPriorities
      .filter(
        (p) =>
          p.rockId === rock.id &&
          (showArchived || !p.archived) &&
          (!mineOnly || p.ownerId === me) &&
          (!statusF || p.status === statusF),
      )
      .sort(sortPriorities);
  }, [allPriorities, rock, showArchived, mineOnly, statusF, me]);

  if (!rock) {
    return (
      <Page>
        <Link to="/align/rocks" className="small muted rock-back">
          <ArrowLeft size={14} /> Rocks
        </Link>
        <PageHeader eyebrow="Align" title={loading ? '…' : t('Rock introuvable', 'Rock not found')} />
        {!loading && (
          <div className="card">
            <Empty icon={<ArrowLeft size={36} />} title={t('Ce Rock n’existe pas ou a été supprimé.', 'This Rock does not exist or was deleted.')} />
          </div>
        )}
      </Page>
    );
  }

  const archive = async () => {
    try {
      await rocks.update(rock.id, { archived: !rock.archived });
      toast(rock.archived ? t('Rock réactivé', 'Rock restored') : t('Rock archivé', 'Rock archived'));
    } catch (e) {
      toast(errorText(e), 'err');
    }
  };

  const remove = async () => {
    const ok = window.confirm(
      t(
        `Supprimer le Rock « ${rock.title} » ? Ses priorités seront conservées, mais ne seront plus rattachées à un Rock. Action irréversible.`,
        `Delete the Rock "${rock.title}"? Its priorities are kept but no longer linked to a Rock. This cannot be undone.`,
      ),
    );
    if (!ok) return;
    try {
      await rocks.remove(rock.id);
      toast(t('Rock supprimé', 'Rock deleted'));
      navigate('/align/rocks');
    } catch (e) {
      toast(errorText(e), 'err');
    }
  };

  const thrustText = rock.thrust != null ? thrusts[rock.thrust] : undefined;
  const initiativeText = rock.initiative != null ? initiatives[rock.initiative]?.text : undefined;
  const done = progress?.done ?? 0;
  const total = progress?.total ?? 0;
  const pct = progress?.pct ?? 0;

  return (
    <Page wide>
      <Link to="/align/rocks" className="small muted rock-back">
        <ArrowLeft size={14} /> Rocks
      </Link>
      <PageHeader
        eyebrow={`Align · ${quarterLabel(rock.quarter)}`}
        title={rock.title}
        actions={
          canManage ? (
            <>
              <button className="btn" onClick={() => setEditing(true)}>
                <Pencil size={15} /> {t('Modifier', 'Edit')}
              </button>
              <button className="btn" onClick={archive}>
                {rock.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                {rock.archived ? t('Réactiver', 'Restore') : t('Archiver', 'Archive')}
              </button>
              <button className="btn btn-danger" onClick={remove}>
                <Trash2 size={15} /> {t('Supprimer', 'Delete')}
              </button>
            </>
          ) : undefined
        }
      />

      <div className="card card-pad stack" style={{ gap: 16 }}>
        <div className="row row-wrap" style={{ gap: 28 }}>
          <div>
            <div className="small muted">{t('Responsable', 'Owner')}</div>
            <strong>{userName(rock.ownerId ?? undefined)}</strong>
          </div>
          <div>
            <div className="small muted">{t('Trimestre', 'Quarter')}</div>
            <strong>{quarterLabel(rock.quarter)}</strong>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="small muted">{t('Priorité stratégique liée', 'Linked key thrust')}</div>
            <span>
              {thrustText ? `${t('Axe', 'Thrust')} ${(rock.thrust ?? 0) + 1} — ${thrustText}` : t('Aucune', 'None')}
            </span>
            <div className="small muted" style={{ marginTop: 10 }}>
              {t('Initiative clé liée', 'Linked key initiative')}
            </div>
            <span>
              {initiativeText ? `${t('Initiative', 'Initiative')} ${(rock.initiative ?? 0) + 1} — ${initiativeText}` : t('Aucune', 'None')}
            </span>
          </div>
          {rock.archived && <span className="badge">{t('Archivé', 'Archived')}</span>}
        </div>
        {rock.description && <p className="rock-desc">{rock.description}</p>}
        <div className="stack" style={{ gap: 8 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>{t('Avancement', 'Progress')}</span>
            <strong className="rock-big-pct">{pct} %</strong>
          </div>
          <ProgressBar pct={pct} large />
          <span className="small muted">{t(`${done} / ${total} priorités terminées`, `${done} / ${total} priorities completed`)}</span>
        </div>
      </div>

      <div className="card card-pad stack" style={{ gap: 14, marginTop: 16 }}>
        <div className="row row-wrap" style={{ justifyContent: 'space-between', gap: 10 }}>
          <h3 style={{ margin: 0 }}>{t('Priorités', 'Priorities')}</h3>
          {canPriorities && (
            <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
              <Plus size={14} /> {t('Priorité', 'Priority')}
            </button>
          )}
        </div>
        <div className="row row-wrap" style={{ gap: 14 }}>
          <label className="check">
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
            {t('Mes priorités seulement', 'My priorities only')}
          </label>
          <select
            className="select"
            style={{ width: 190 }}
            aria-label={t('Statut', 'Status')}
            value={statusF}
            onChange={(e) => setStatusF(e.target.value as PriorityStatus | '')}
          >
            <option value="">{t('Tous les statuts', 'All statuses')}</option>
            {(Object.keys(STATUS_LABEL) as PriorityStatus[]).map((s) => (
              <option key={s} value={s}>
                {t(STATUS_LABEL[s])}
              </option>
            ))}
          </select>
          <label className="check">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            {t('Afficher les archivées', 'Show archived')}
          </label>
        </div>

        {!linkedCount ? (
          <Empty icon={<Plus size={36} />} title={t('Aucune priorité pour ce Rock', 'No priorities for this Rock')}>
            {canPriorities && (
              <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
                <Plus size={14} /> {t('Priorité', 'Priority')}
              </button>
            )}
          </Empty>
        ) : !rows.length ? (
          <Empty icon={<Plus size={36} />} title={t('Aucun résultat pour ces filtres', 'No result for these filters')} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Priorité', 'Priority')}</th>
                  <th>{t('Responsable', 'Owner')}</th>
                  <th>{t('Échéance', 'Due date')}</th>
                  <th>{t('Statut', 'Status')}</th>
                  <th>{t('Santé', 'Health')}</th>
                  <th>{t('Avancement', 'Progress')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const blocker = p.blockedById ? byId.get(p.blockedById) : undefined;
                  const blocked = isBlocked(p, byId);
                  const late = isOverdue(p);
                  const pctP = priorityPct(p);
                  return (
                    <tr
                      key={p.id}
                      className="clickable"
                      tabIndex={0}
                      onClick={() => setOpenId(p.id)}
                      onKeyDown={(e) => e.key === 'Enter' && setOpenId(p.id)}
                      style={p.archived ? { opacity: 0.6 } : undefined}
                    >
                      <td>
                        <div className="rock-priority-title">{p.title}</div>
                        {blocked && (
                          <span className="badge badge-warn">
                            {blocker ? t(`Bloquée par « ${blocker.title} »`, `Blocked by "${blocker.title}"`) : t('Bloquée', 'Blocked')}
                          </span>
                        )}
                        {p.archived && <span className="badge">{t('Archivée', 'Archived')}</span>}
                      </td>
                      <td>{userName(p.ownerId ?? undefined)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {p.dueDate ? fmtDate(p.dueDate) : '—'}{' '}
                        {late && <span className="badge badge-err">{t('En retard', 'Overdue')}</span>}
                      </td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                      <td>
                        <HealthDot health={p.health} withLabel />
                      </td>
                      <td>
                        <div className="rock-progress-cell">
                          <ProgressBar pct={pctP} />
                          <span className="small mono">{pctP} %</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <RockFormModal rock={rock} defaultQuarter={rock.quarter} nextOrder={allRocks.length} thrusts={thrusts} people={people} onClose={() => setEditing(false)} />}
      {adding && <PriorityNewModal rock={rock} all={allPriorities} people={people} onClose={() => setAdding(false)} />}
      {openId && <PriorityPanel priorityId={openId} onClose={() => setOpenId(null)} />}
    </Page>
  );
}
