/**
 * Navigation between members for the member page (MemberWeek), for both routes:
 *   /align/team/:userId                          every active user, sorted by name; back to the team
 *   /align/huddles/:id/members/:userId           the huddle's members (memberIds + owner), sorted by name; back to the huddle
 * No wrap-around: prevId and nextId are null at the ends. hrefFor keeps the ?week= of the current URL.
 */
import { useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useCollection } from '@/data/db';
import { users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { alignHuddles } from '../stores';
import { weekFromParam } from '../week';

export interface MemberNav {
  /** Ordered member ids of the current route. */
  ids: string[];
  prevId: string | null;
  nextId: string | null;
  /** Where the back arrow goes. */
  backTo: string;
  backLabel: string;
  /** Link to another member's page, same route, same ?week=. */
  hrefFor: (userId: string) => string;
  /** The huddle of the current route, or null on the team route. */
  huddleId: string | null;
  huddleName: string | null;
}

export function useMemberNav(): MemberNav {
  const { id, userId = '' } = useParams();
  const { t, lang } = useI18n();
  const [params] = useSearchParams();
  const { rows: allUsers } = useCollection(users);
  const { rows: huddles } = useCollection(alignHuddles);

  const huddleId = id ?? null;
  const huddle = useMemo(() => (huddleId ? huddles.find((h) => h.id === huddleId) : undefined), [huddles, huddleId]);

  const ids = useMemo(() => {
    const byName = (a: { displayName: string }, b: { displayName: string }) => a.displayName.localeCompare(b.displayName, lang);
    if (!huddleId) return allUsers.filter((u) => u.active).sort(byName).map((u) => u.id);
    if (!huddle) return [];
    const members = new Set([...huddle.memberIds, ...(huddle.ownerId ? [huddle.ownerId] : [])]);
    return allUsers.filter((u) => members.has(u.id)).sort(byName).map((u) => u.id);
  }, [allUsers, huddleId, huddle, lang]);

  const idx = ids.indexOf(userId);
  const prevId = idx > 0 ? ids[idx - 1] : null;
  const nextId = idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null;

  const rawWeek = params.get('week');
  const qs = rawWeek && weekFromParam(rawWeek) === rawWeek ? `?week=${rawWeek}` : '';

  const memberBase = huddleId ? `/align/huddles/${huddleId}/members` : '/align/team';
  const hrefFor = useCallback((uid: string) => `${memberBase}/${uid}${qs}`, [memberBase, qs]);

  return {
    ids,
    prevId,
    nextId,
    backTo: huddleId ? `/align/huddles/${huddleId}` : '/align/team',
    backLabel: huddleId ? (huddle?.name ?? t('Huddle', 'Huddle')) : 'Équipe / Team',
    hrefFor,
    huddleId,
    huddleName: huddle?.name ?? null,
  };
}
