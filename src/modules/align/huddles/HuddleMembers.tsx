import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { Empty } from '@/components/ui';
import { Collapsible, MemberAvatar } from '../components/WeekKit';
import { thisWeek } from '../week';

export interface MemberStat {
  openTasks: number;
  openPrio: number;
  blocked: number;
  whatsUp: boolean;
}

/** The member's page in a huddle, for a given week (the current week needs no ?week=). */
export const memberPath = (huddleId: string, userId: string, week: string) =>
  `/align/huddles/${huddleId}/members/${userId}${week !== thisWeek() ? `?week=${week}` : ''}`;

/** Member tiles (photo or initials) with the week's stats. Replaces the per-person priority cards. */
export function HuddleMembers({
  huddleId,
  ownerId,
  week,
  members,
  userById,
  userName,
  stats,
  canSettings,
}: {
  huddleId: string;
  ownerId: string | null;
  week: string;
  /** Sorted member ids. */
  members: string[];
  userById: Map<string, User>;
  userName: (id?: string | null) => string;
  stats: Map<string, MemberStat>;
  canSettings: boolean;
}) {
  const { t } = useI18n();
  return (
    <Collapsible id="huddle.members" title={t('Membres', 'Members')} icon={<Users size={18} />} count={members.length}>
      {!members.length ? (
        <Empty icon={<Users size={32} />} title={t('Aucun membre dans ce huddle', 'No member in this huddle')}>
          {canSettings ? t('Ajoutez des membres dans les paramètres.', 'Add members in the settings.') : null}
        </Empty>
      ) : (
        <div className="align-member-grid">
          {members.map((id) => {
            const name = userName(id);
            const s = stats.get(id);
            return (
              <Link key={id} to={memberPath(huddleId, id, week)} className="align-member-tile">
                <MemberAvatar user={userById.get(id)} name={name} size={56} />
                <div className="align-tile-name">
                  <strong>{name}</strong>
                  {id === ownerId && <span className="badge">{t('Animateur', 'Host')}</span>}
                </div>
                <div className="small muted">
                  {t(`${s?.openTasks ?? 0} tâche(s) ouverte(s)`, `${s?.openTasks ?? 0} open task(s)`)} ·{' '}
                  {t(`${s?.openPrio ?? 0} priorité(s)`, `${s?.openPrio ?? 0} open priority(ies)`)}
                </div>
                {!!s?.blocked && <span className="badge badge-warn">{t(`${s.blocked} bloquée(s)`, `${s.blocked} blocked`)}</span>}
                <div className="small align-member-whatsup">
                  <span className={`align-whatsup-dot${s?.whatsUp ? ' is-on' : ''}`} aria-hidden="true" />
                  {s?.whatsUp ? t('Quoi de neuf écrit', 'What’s up written') : t('Quoi de neuf à écrire', 'What’s up not written yet')}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Collapsible>
  );
}
