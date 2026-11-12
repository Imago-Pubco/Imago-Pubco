import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ExternalLink, Plus, Presentation, Settings, Users as UsersIcon } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useCollection } from '@/data/db';
import { users } from '@/data/stores';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, PageHeader } from '@/components/ui';
import { Avatar } from '@/modules/admin/pages/Users';
import { teams, huddles } from '../stores';
import type { Huddle, Team } from '../schemas';
import { HuddleModal } from '../Huddles.form';
import { cadenceText, draftFromHuddle, newDraft, type HuddleDraft, type Tr } from '../Huddles.helpers';

const MAX_AVATARS = 6;

/** Huddles: the recurring team meetings and their settings. */
export function Huddles() {
  const { t } = useI18n();
  const { user: me } = useAuth();
  const { rows: huddleRows } = useCollection(huddles);
  const { rows: teamRows } = useCollection(teams);
  const { rows: userRows } = useCollection(users);
  const [showInactive, setShowInactive] = useState(false);
  const [draft, setDraft] = useState<HuddleDraft | null>(null);
  const [err, setErr] = useState('');

  const teamById = useMemo(() => new Map(teamRows.map((tm) => [tm.id, tm])), [teamRows]);
  const userById = useMemo(() => new Map(userRows.map((u) => [u.id, u])), [userRows]);

  const visible = useMemo(
    () =>
      huddleRows
        .filter((h) => showInactive || h.active)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [huddleRows, showInactive],
  );

  const open = (h?: Huddle) => {
    setErr('');
    setDraft(h ? draftFromHuddle(h) : newDraft(me?.id ?? null));
  };

  const createButton = (
    <button className="btn btn-primary" onClick={() => open()} data-tour="huddles-new">
      <Plus size={16} /> {t('Huddle', 'Huddle')}
    </button>
  );

  return (
    <Page>
      <PageHeader eyebrow={t('Outils · KPI', 'Tools · KPI')} title={t('Huddles', 'Huddles')} actions={createButton} />

      <div data-tour="huddles-list">
      {huddleRows.length === 0 ? (
        <Empty icon={<Presentation size={40} />} title={t('Aucun huddle pour l’instant', 'No huddles yet')}>
          <p style={{ margin: '0 0 12px' }}>
            {t(
              'Un huddle est une réunion d’équipe récurrente de 15 à 30 minutes : on fait le point sur les priorités, les indicateurs et le parking lot.',
              'A huddle is a recurring 15 to 30 minute team meeting: a check on priorities, KPIs and the parking lot.',
            )}
          </p>
          {createButton}
        </Empty>
      ) : (
        <>
          <div className="row row-wrap" style={{ marginBottom: 16 }}>
            <label className="check">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              {t('Afficher les inactifs', 'Show inactive')}
            </label>
          </div>
          {visible.length === 0 ? (
            <p className="faint">{t('Aucun huddle actif.', 'No active huddle.')}</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 16 }}>
              {visible.map((h) => (
                <HuddleCard
                  key={h.id}
                  huddle={h}
                  team={h.teamId ? teamById.get(h.teamId) : undefined}
                  ownerName={h.ownerId ? (userById.get(h.ownerId)?.displayName ?? h.ownerId) : t('Aucun', 'None')}
                  members={h.memberIds.map((id) => userById.get(id)).filter((u): u is User => !!u)}
                  onSettings={() => open(h)}
                />
              ))}
            </div>
          )}
        </>
      )}
      </div>

      <HuddleModal draft={draft} setDraft={setDraft} err={err} setErr={setErr} />
    </Page>
  );
}

function HuddleCard({
  huddle: h,
  team,
  ownerName,
  members,
  onSettings,
}: {
  huddle: Huddle;
  team: Team | undefined;
  ownerName: string;
  members: User[];
  onSettings: () => void;
}) {
  const { t } = useI18n();
  const shown = members.slice(0, MAX_AVATARS);
  const more = members.length - shown.length;
  const sections = h.teamSections.length + h.personalSections.length;
  const videoOk = /^https?:\/\//i.test(h.videoUrl);
  const tr: Tr = (fr, en) => t(fr, en);

  return (
    <div className="card" style={{ opacity: h.active ? 1 : 0.55, display: 'flex', flexDirection: 'column' }}>
      <div className="card-pad stack" style={{ flex: 1 }}>
        <div className="row row-wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ minWidth: 0, flex: '1 1 160px' }}>
            <div style={{ fontWeight: 600, fontSize: 16, overflowWrap: 'anywhere' }}>{h.name}</div>
            <div className="row row-wrap" style={{ gap: 6, marginTop: 6 }}>
              {team ? (
                <span className="badge" style={{ background: `color-mix(in srgb, ${team.color || '#888'} 16%, transparent)`, color: team.color || undefined }}>
                  {team.name}
                </span>
              ) : (
                <span className="faint small">{t('Sans équipe', 'No team')}</span>
              )}
            </div>
          </div>
          {!h.active && <span className="badge">{t('Inactif', 'Inactive')}</span>}
        </div>

        <div className="small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <CalendarDays size={14} color="var(--text-3)" />
          <span>{cadenceText(h, tr)}</span>
        </div>

        <div className="small">
          <span className="faint">{t('Responsable', 'Owner')} : </span>
          {ownerName}
        </div>

        <div className="row row-wrap" style={{ gap: 6 }}>
          <UsersIcon size={14} color="var(--text-3)" />
          {members.length === 0 && <span className="faint small">{t('Aucun membre', 'No members')}</span>}
          {shown.map((u) => (
            <span key={u.id} title={u.displayName} style={{ display: 'inline-flex' }}>
              <Avatar name={u.displayName} size={26} />
            </span>
          ))}
          {more > 0 && <span className="small faint">+{more}</span>}
        </div>

        <div className="small faint">
          {t(`${sections} section(s)`, `${sections} section(s)`)}
        </div>

        {videoOk && (
          <a className="small" href={h.videoUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', gap: 4, alignItems: 'center', color: 'var(--accent)' }}>
            <ExternalLink size={13} /> {t('Lien vidéo', 'Video link')}
          </a>
        )}
      </div>

      <div className="row row-wrap" style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', gap: 8, justifyContent: 'space-between' }}>
        <Link className="btn btn-primary btn-sm" to={`/tools/kpi/huddles/${h.id}`}>
          {t('Ouvrir la réunion', 'Open meeting')}
        </Link>
        <button className="btn btn-sm" onClick={onSettings}>
          <Settings size={14} /> {t('Paramètres', 'Settings')}
        </button>
      </div>
    </div>
  );
}
