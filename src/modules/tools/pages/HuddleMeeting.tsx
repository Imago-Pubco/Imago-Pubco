import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, Maximize2, Minimize2, Presentation, Settings, Video } from 'lucide-react';
import type { User } from '@/data/types';
import { useCollection } from '@/data/db';
import { users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { useAuth } from '@/auth/AuthContext';
import { Page } from '@/components/Page';
import { Empty, useToast } from '@/components/ui';
import { addWeeks, currentWeek, periodLabel } from '../lib';
import { huddles, teams, kpis, kpiValues, priorities, priorityUpdates, tasks, huddleItems, huddleEntries } from '../stores';
import { buildSummary, normaliseWeek, timeSentence, type MeetingData } from '../HuddleMeeting.data';
import { TeamSectionView } from '../HuddleMeeting.sections';
import { MemberCard } from '../HuddleMeeting.member';
import { SectionCard } from '../HuddleMeeting.ui';

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;

/** The screen a team projects during its weekly huddle: header, week, team sections and the round table. */
export function HuddleMeeting() {
  const { t, lang } = useI18n();
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();
  const me = user?.id ?? '';
  const week = normaliseWeek(params.get('week'));

  const { rows: huddleRows, loading } = useCollection(huddles);
  const { rows: teamRows } = useCollection(teams);
  const { rows: kpiRows } = useCollection(kpis);
  const { rows: kpiValueRows } = useCollection(kpiValues);
  const { rows: priorityRows } = useCollection(priorities);
  const { rows: updateRows } = useCollection(priorityUpdates);
  const { rows: taskRows } = useCollection(tasks);
  const { rows: itemRows } = useCollection(huddleItems);
  const { rows: entryRows } = useCollection(huddleEntries);
  const { rows: userRows } = useCollection(users);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [meFirst, setMeFirst] = useState(false);
  const [purposeOpen, setPurposeOpen] = useState(true);

  const huddle = huddleRows.find((h) => h.id === id);

  const data = useMemo<MeetingData | null>(() => {
    if (!huddle) return null;
    const byId = new Map<string, User>(userRows.map((u) => [u.id, u]));
    // Members, then the owner when the owner is not a member; inactive people are left out.
    const memberIds = Array.from(new Set([...huddle.memberIds, ...(huddle.ownerId ? [huddle.ownerId] : [])]));
    const members = memberIds.map((x) => byId.get(x)).filter((u): u is User => u !== undefined && u.active);
    return {
      huddle,
      week,
      me,
      lang,
      team: teamRows.find((x) => x.id === huddle.teamId),
      members,
      nameOf: (x) => (x ? (byId.get(x)?.displayName ?? x) : '—'),
      kpis: kpiRows,
      kpiValues: kpiValueRows,
      priorities: priorityRows,
      priorityUpdates: updateRows,
      tasks: taskRows,
      items: itemRows,
      entries: entryRows,
    };
  }, [huddle, week, me, lang, userRows, teamRows, kpiRows, kpiValueRows, priorityRows, updateRows, taskRows, itemRows, entryRows]);

  if (!data) {
    return (
      <Page>
        {loading ? (
          <p className="faint">{t('Chargement…', 'Loading…')}</p>
        ) : (
          <div className="card">
            <Empty icon={<Presentation size={40} />} title={t('Huddle introuvable', 'Huddle not found')}>
              <Link to="/tools/kpi/huddles" className="btn btn-sm" style={{ marginTop: 8 }}>
                <ArrowLeft size={15} />
                {t('Retour aux huddles', 'Back to huddles')}
              </Link>
            </Empty>
          </div>
        )}
      </Page>
    );
  }

  const h = data.huddle;
  const video = /^https?:\/\//i.test(h.videoUrl) ? h.videoUrl : '';
  const team = data.team;
  const teamColor = team && HEX_COLOR.test(team.color) ? team.color : 'var(--accent)';
  const ordered = meFirst ? [...data.members].sort((a, b) => Number(b.id === me) - Number(a.id === me)) : data.members;

  const go = (target: string | null) => {
    const next = new URLSearchParams(params);
    if (target === null) next.delete('week');
    else next.set('week', target);
    setParams(next);
  };

  const toggleMember = (memberId: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildSummary(data));
      toast(t('Résumé copié', 'Summary copied'));
    } catch {
      toast(t('Copie impossible', 'Could not copy'), 'err');
    }
  };

  return (
    <Page wide>
      <Link to="/tools/kpi/huddles" className="small muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <ArrowLeft size={15} />
        {t('Huddles', 'Huddles')}
      </Link>

      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">{t('Outils · KPI · Huddle', 'Tools · KPI · Huddle')}</div>
          <h1 style={{ overflowWrap: 'anywhere' }}>{h.name}</h1>
          <div className="row row-wrap" style={{ gap: 10, marginTop: 8 }}>
            {team && (
              <span className="badge" style={{ background: `color-mix(in srgb, ${teamColor} 16%, transparent)`, color: teamColor }}>
                {team.name}
              </span>
            )}
            <span className="muted">{timeSentence(h, week, lang)}</span>
          </div>
        </div>
        {video && (
          <div className="row row-wrap">
            <a className="btn btn-primary" href={video} target="_blank" rel="noopener noreferrer">
              <Video size={16} />
              {t('Rejoindre la réunion', 'Join the meeting')}
            </a>
          </div>
        )}
      </div>

      <div className="card card-pad row row-wrap" style={{ gap: 10, alignItems: 'center', margin: '16px 0' }}>
        <button type="button" className="btn btn-sm btn-icon" onClick={() => go(addWeeks(week, -1))} aria-label={t('Semaine précédente', 'Previous week')}>
          <ChevronLeft size={18} />
        </button>
        <strong style={{ minWidth: 190, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{periodLabel(week, 'weekly', lang)}</strong>
        <button type="button" className="btn btn-sm btn-icon" onClick={() => go(addWeeks(week, 1))} aria-label={t('Semaine suivante', 'Next week')}>
          <ChevronRight size={18} />
        </button>
        <button type="button" className="btn btn-sm" onClick={() => go(null)} disabled={week === currentWeek()}>
          {t('Cette semaine', 'This week')}
        </button>
        <span className="spacer" />
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setCollapsed(new Set())}>
          <Maximize2 size={15} />
          {t('Tout développer', 'Expand all')}
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setCollapsed(new Set(data.members.map((m) => m.id)))}>
          <Minimize2 size={15} />
          {t('Tout réduire', 'Collapse all')}
        </button>
        <button type="button" className={`btn btn-sm ${meFirst ? 'btn-primary' : ''}`} aria-pressed={meFirst} onClick={() => setMeFirst((v) => !v)}>
          {t("Moi d'abord", 'Me first')}
        </button>
        <button type="button" className="btn btn-sm" onClick={copySummary}>
          <Copy size={15} />
          {t('Copier le résumé', 'Copy summary')}
        </button>
        <Link to="/tools/kpi/huddles" className="btn btn-sm btn-ghost">
          <Settings size={15} />
          {t('Paramètres', 'Settings')}
        </Link>
      </div>

      <SectionCard title={t('But et ordre du jour', 'Purpose and agenda')} open={purposeOpen} onToggle={() => setPurposeOpen((v) => !v)}>
        {h.description.trim() ? (
          <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{h.description}</div>
        ) : (
          <p className="faint small" style={{ margin: 0 }}>
            {t('Aucune description.', 'No description.')}
          </p>
        )}
      </SectionCard>

      {h.teamSections.map((section) => (
        <TeamSectionView key={section} section={section} data={data} />
      ))}

      <div style={{ margin: '28px 0 12px' }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{t('Tour de table', 'Round table')}</h2>
        <p className="muted small" style={{ margin: '4px 0 0' }}>
          {t(
            'Chacun répond pour sa propre section. Les vôtres sont modifiables ; celles des autres sont en lecture seule, sauf pour le propriétaire du huddle.',
            'Each person answers for their own section. Yours are editable; others are read-only, except for the huddle owner.',
          )}
        </p>
      </div>
      {ordered.length === 0 ? (
        <p className="faint">{t('Aucun membre actif.', 'No active members.')}</p>
      ) : (
        ordered.map((m) => (
          <MemberCard key={m.id} data={data} member={m} open={!collapsed.has(m.id)} onToggle={() => toggleMember(m.id)} />
        ))
      )}
    </Page>
  );
}
