import { useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, Pencil, Plus, Presentation, Trash2, UserRound, Users, Video } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useCollection } from '@/data/db';
import { useUserName } from '@/data/hooks';
import { logAudit, users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, PageHeader, useToast } from '@/components/ui';
import { alignHuddles } from '../stores';
import type { AlignHuddle } from '../schemas';
import { HuddleForm } from '../huddles/HuddleForm';
import { errorText } from '../components/RockShared';
import { canEditHuddle, scheduleLabel } from '../huddles/huddleLib';

export function Huddles() {
  const { t, lang } = useI18n();
  const { user, can } = useAuth();
  const userName = useUserName();
  const navigate = useNavigate();
  const toast = useToast();
  const { rows: huddles, loading } = useCollection(alignHuddles);
  const { rows: allUsers } = useCollection(users);
  const [showInactive, setShowInactive] = useState(false);
  // undefined = form closed, null = new huddle, otherwise the huddle being edited.
  const [editing, setEditing] = useState<AlignHuddle | null | undefined>(undefined);

  const canManage = can('align.huddles.manage');
  const people = useMemo(
    () => allUsers.filter((u) => u.active).sort((a, b) => a.displayName.localeCompare(b.displayName, lang)),
    [allUsers, lang],
  );
  const list = useMemo(
    () =>
      huddles
        .filter((h) => showInactive || h.active)
        .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, lang)),
    [huddles, showInactive, lang],
  );

  async function remove(h: AlignHuddle) {
    if (!window.confirm(t(`Supprimer le huddle « ${h.name} » ?`, `Delete huddle “${h.name}”?`))) return;
    try {
      await alignHuddles.remove(h.id);
      logAudit(user!.id, 'align.huddle.delete', h.name).catch(() => undefined);
      toast(t('Huddle supprimé', 'Huddle deleted'));
    } catch (e) {
      toast(errorText(e), 'err');
    }
  }

  const open = (h: AlignHuddle) => navigate(`/align/huddles/${h.id}`);
  const onCardKey = (e: KeyboardEvent, h: AlignHuddle) => {
    // Keys pressed on the nested Edit / Delete buttons belong to them, not to the card.
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open(h);
    }
  };

  return (
    <Page>
      <PageHeader
        eyebrow="Align"
        title="Huddles"
        subtitle={t('Réunions d’équipe qui font le suivi des Rocks et des priorités.', 'Team meetings that follow up on Rocks and priorities.')}
        actions={
          <>
            <label className="check">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              {t('Afficher les inactifs', 'Show inactive')}
            </label>
            {canManage && (
              <button className="btn btn-primary" onClick={() => setEditing(null)}>
                <Plus size={16} /> {t('Huddle', 'Huddle')}
              </button>
            )}
          </>
        }
      />

      {!loading && !list.length ? (
        <div className="card">
          <Empty icon={<Presentation size={36} />} title={t('Aucun huddle', 'No huddle')}>
            {canManage ? (
              <button className="btn btn-primary btn-sm" onClick={() => setEditing(null)}>
                <Plus size={14} /> {t('Huddle', 'Huddle')}
              </button>
            ) : (
              t('Un gestionnaire peut en créer un.', 'A manager can create one.')
            )}
          </Empty>
        </div>
      ) : (
        <div className="align-huddle-grid">
          {list.map((h) => {
            const canEdit = canEditHuddle(h, user!.id, canManage);
            return (
              <article
                key={h.id}
                className={`card card-pad align-huddle-card${h.active ? '' : ' is-inactive'}`}
                role="link"
                tabIndex={0}
                aria-label={h.name}
                onClick={() => open(h)}
                onKeyDown={(e) => onCardKey(e, h)}
              >
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <h3 className="align-huddle-title">{h.name}</h3>
                  <div className="row" style={{ gap: 4, flexShrink: 0 }}>
                    {!h.active && <span className="badge">{t('Inactif', 'Inactive')}</span>}
                    {canEdit && (
                      <>
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          title={t('Modifier', 'Edit')}
                          aria-label={t('Modifier', 'Edit')}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(h);
                          }}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          title={t('Supprimer', 'Delete')}
                          aria-label={t('Supprimer', 'Delete')}
                          onClick={(e) => {
                            e.stopPropagation();
                            void remove(h);
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {h.description && <p className="muted small align-huddle-desc">{h.description}</p>}

                <div className="stack" style={{ gap: 6, marginTop: 10 }}>
                  <div className="small row" style={{ gap: 6 }}>
                    <CalendarClock size={14} /> {scheduleLabel(h, lang)}
                  </div>
                  <div className="small row" style={{ gap: 6 }}>
                    <UserRound size={14} /> {t('Responsable', 'Owner')} : {h.ownerId ? userName(h.ownerId) : '—'}
                  </div>
                  <div className="small row" style={{ gap: 12 }}>
                    <span className="row" style={{ gap: 6 }}>
                      <Users size={14} /> {h.memberIds.length} {t(h.memberIds.length > 1 ? 'membres' : 'membre', h.memberIds.length > 1 ? 'members' : 'member')}
                    </span>
                    {h.videoUrl && (
                      <span className="row" style={{ gap: 6 }}>
                        <Video size={14} /> {t('Visio', 'Video')}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing !== undefined && (
        <HuddleForm huddle={editing} people={people} onClose={() => setEditing(undefined)} />
      )}
    </Page>
  );
}
