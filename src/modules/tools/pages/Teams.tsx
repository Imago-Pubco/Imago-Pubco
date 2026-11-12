import { useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useCollection } from '@/data/db';
import { useUserName } from '@/data/hooks';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, PageHeader } from '@/components/ui';
import { Avatar } from '@/modules/admin/pages/Users';
import { TEAM_COLORS, TeamModal, blankTeam } from '../Teams.form';
import type { Team } from '../schemas';
import { huddles, kpis, priorities, teams } from '../stores';

export function Teams() {
  const { t } = useI18n();
  const { user } = useAuth();
  const userName = useUserName();
  const { rows } = useCollection(teams);
  const { rows: allKpis } = useCollection(kpis);
  const { rows: allPriorities } = useCollection(priorities);
  const { rows: allHuddles } = useCollection(huddles);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<{ team: Team; existing: boolean } | null>(null);

  const visible = rows.filter((x) => showArchived || !x.archived).sort((a, b) => a.name.localeCompare(b.name));

  const countsFor = (id: string) => ({
    kpis: allKpis.filter((k) => k.teamId === id).length,
    priorities: allPriorities.filter((p) => p.teamId === id && !p.archived).length,
    huddles: allHuddles.filter((h) => h.teamId === id).length,
  });

  const openNew = () => setEditing({ team: blankTeam(user!.id, TEAM_COLORS[rows.length % TEAM_COLORS.length]), existing: false });
  const openEdit = (team: Team) => setEditing({ team: { ...team, memberIds: [...team.memberIds] }, existing: true });

  return (
    <Page>
      <PageHeader
        eyebrow={t('Outils · KPI', 'Tools · KPI')}
        title={t('Équipes', 'Teams')}
        subtitle={t('Groupes de personnes qui travaillent ensemble, avec leurs indicateurs, priorités et huddles.', 'Groups of people who work together, with their KPIs, priorities and huddles.')}
        actions={
          <button className="btn btn-primary" onClick={openNew} data-tour="teams-new">
            <Plus size={16} /> {t('Équipe', 'Team')}
          </button>
        }
      />

      <label className="check" style={{ marginBottom: 16 }}>
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        {t('Afficher les archivées', 'Show archived')}
      </label>

      <div data-tour="teams-list">
      {!rows.length ? (
        <div className="card">
          <Empty icon={<Users size={36} />} title={t('Aucune équipe', 'No teams yet')}>
            {t('Créez la première équipe pour y rattacher des indicateurs, des priorités et des huddles.', 'Create the first team to attach KPIs, priorities and huddles to it.')}
          </Empty>
        </div>
      ) : !visible.length ? (
        <div className="card">
          <Empty icon={<Users size={36} />} title={t('Aucune équipe active', 'No active team')}>
            {t('Cochez « Afficher les archivées » pour les voir.', 'Tick “Show archived” to see them.')}
          </Empty>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {visible.map((team) => (
            <TeamCard key={team.id} team={team} counts={countsFor(team.id)} userName={userName} onOpen={() => openEdit(team)} />
          ))}
        </div>
      )}
      </div>

      {editing && <TeamModal key={editing.team.id} team={editing.team} existing={editing.existing} onClose={() => setEditing(null)} />}
    </Page>
  );
}

function TeamCard({
  team,
  counts,
  userName,
  onOpen,
}: {
  team: Team;
  counts: { kpis: number; priorities: number; huddles: number };
  userName: (id?: string) => string;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const shown = team.memberIds.slice(0, 6);
  const extra = team.memberIds.length - shown.length;
  return (
    <div
      role="button"
      tabIndex={0}
      className="card"
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      style={{ cursor: 'pointer', overflow: 'hidden', opacity: team.archived ? 0.6 : 1 }}
    >
      <div style={{ height: 6, background: team.color }} />
      <div className="card-pad stack" style={{ gap: 12 }}>
        <div>
          <div className="row row-wrap" style={{ gap: 8 }}>
            <strong style={{ fontSize: 16 }}>{team.name}</strong>
            {team.archived && <span className="badge">{t('Archivée', 'Archived')}</span>}
          </div>
          {team.description && (
            <p className="muted small" style={{ margin: '6px 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {team.description}
            </p>
          )}
        </div>
        <div className="small">
          <span className="faint">{t('Responsable', 'Owner')} : </span>
          {userName(team.ownerId)}
        </div>
        <div className="row row-wrap" style={{ gap: 0 }}>
          {shown.map((id, i) => (
            <span key={id} style={{ marginLeft: i ? -8 : 0, borderRadius: '50%', boxShadow: '0 0 0 2px var(--bg-elev)', display: 'inline-flex' }}>
              <Avatar name={userName(id)} size={28} />
            </span>
          ))}
          {extra > 0 && <span className="badge" style={{ marginLeft: 6 }}>+{extra}</span>}
          <span className="faint small" style={{ marginLeft: 10 }}>
            {t(`${team.memberIds.length} membre(s)`, `${team.memberIds.length} member(s)`)}
          </span>
        </div>
        <div className="row row-wrap small muted" style={{ gap: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <span><strong>{counts.kpis}</strong> KPI</span>
          <span><strong>{counts.priorities}</strong> {t('priorité(s)', 'priority(ies)')}</span>
          <span><strong>{counts.huddles}</strong> Huddle(s)</span>
        </div>
      </div>
    </div>
  );
}
