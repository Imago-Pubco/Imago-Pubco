import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, ChevronLeft, ChevronRight, ListChecks, ListTodo, MessageSquare, Trash2, Users } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { uid, useCollection } from '@/data/db';
import { useUserName } from '@/data/hooks';
import { users } from '@/data/stores';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, useToast } from '@/components/ui';
import { isBlocked, isOverdue, priorityInQuarter } from '../lib';
import { Collapsible, MemberAvatar, WeekPicker, useWeekParam } from '../components/WeekKit';
import { errorText } from '../components/RockShared';
import { alignPriorities, checkins, notes, rocks, tasks } from '../stores';
import type { AlignNote, AlignPriority, Checkin, Rock } from '../schemas';
import { groupBy, byDue } from '../huddles/huddleLib';
import { PriorityRow } from '../huddles/PriorityRow';
import { TaskComposer } from '../tasks/TaskComposer';
import { TaskList } from '../tasks/TaskList';
import { checkinId, quarterOfWeek, shiftWeek } from '../week';
import { useMemberNav } from '../team/useMemberNav';

/** Center-crops an image to a square and returns it as a small JPEG data URL. */
async function squarePhoto(file: File, size = 160): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('Image illisible / Unreadable image'));
      im.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponible / Canvas unavailable');
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Open priorities first, then by due date, then by order. */
const prioritySort = (a: AlignPriority, b: AlignPriority) =>
  Number(a.status === 'completed') - Number(b.status === 'completed') || byDue(a, b) || a.order - b.order;

/** "Quoi de neuf": one text per person and week. Editable by the person and by priority managers. */
function WhatsUp({
  userId,
  week,
  checkin,
  canEdit,
  lastWhatsUp,
  userName,
}: {
  userId: string;
  week: string;
  checkin: Checkin | undefined;
  canEdit: boolean;
  lastWhatsUp: string;
  userName: (id?: string) => string;
}) {
  const { t, fmtDate } = useI18n();
  const toast = useToast();
  const saved = checkin?.whatsUp ?? '';
  const [draft, setDraft] = useState(saved);
  const [flash, setFlash] = useState(false);
  const inFlight = useRef(false);

  // Follow the stored text when it arrives or changes (first load, another editor).
  useEffect(() => {
    setDraft(checkin?.whatsUp ?? '');
  }, [checkin?.id, checkin?.whatsUp, week, userId]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(false), 2500);
    return () => clearTimeout(timer);
  }, [flash]);

  async function save() {
    if (inFlight.current || draft === saved) return;
    inFlight.current = true;
    try {
      if (checkin) await checkins.update(checkin.id, { whatsUp: draft });
      else await checkins.insert({ id: checkinId(userId, week), userId, weekStart: week, whatsUp: draft });
      setFlash(true);
    } catch (err) {
      toast(errorText(err), 'err');
    } finally {
      inFlight.current = false;
    }
  }

  const stamp = checkin?.updatedAt
    ? `${t('Mis à jour', 'Updated')} ${checkin.updatedBy ? `${t('par', 'by')} ${userName(checkin.updatedBy)} ` : ''}${t('le', 'on')} ${fmtDate(checkin.updatedAt, true)}`
    : '';

  return (
    <div className="stack" style={{ gap: 8 }}>
      {lastWhatsUp && (
        <details className="align-whatsup-prev">
          <summary className="small muted">{t('Semaine précédente', 'Last week')}</summary>
          <p className="small" style={{ whiteSpace: 'pre-line', margin: '6px 0 0' }}>
            {lastWhatsUp}
          </p>
        </details>
      )}
      {canEdit ? (
        <>
          <textarea
            className="input align-whatsup-input"
            rows={4}
            maxLength={4000}
            aria-label={t('Quoi de neuf ?', "What's up?")}
            placeholder={t('Ce qui se passe de ton côté cette semaine…', "What's going on this week…")}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => void save()}
          />
          <div className="row row-wrap" style={{ justifyContent: 'space-between', gap: 8 }}>
            <span className="small muted">{stamp}</span>
            <div className="row" style={{ gap: 8 }}>
              {flash && (
                <span className="small" style={{ color: 'var(--ok)' }}>
                  {t('Enregistré', 'Saved')}
                </span>
              )}
              <button className="btn btn-primary btn-sm" disabled={draft === saved} onClick={() => void save()}>
                {t('Enregistrer', 'Save')}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="align-whatsup-text">{saved || t("Rien d'inscrit cette semaine", 'Nothing written this week')}</div>
          {stamp && <div className="small muted">{stamp}</div>}
        </>
      )}
    </div>
  );
}

export function MemberWeek() {
  const { t, lang } = useI18n();
  const { user, can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const userName = useUserName();
  const { userId = '' } = useParams();
  const nav = useMemberNav();
  const [week, setWeek] = useWeekParam();
  const quarter = quarterOfWeek(week);
  const prevWeek = shiftWeek(week, -1);

  const me = user!.id;
  const isMe = userId === me;
  const canManage = can('align.priorities.manage');
  const canEdit = isMe || canManage;
  const canPhoto = isMe || can('admin.users.manage');
  const huddleId = nav.huddleId;

  const { rows: allUsers, loading: loadingUsers } = useCollection(users);
  const { rows: allRocks } = useCollection(rocks);
  const { rows: allPriorities } = useCollection(alignPriorities);
  const { rows: allNotes } = useCollection(notes);
  const { rows: allTasks } = useCollection(tasks);
  const { rows: allCheckins } = useCollection(checkins);

  const [photoBusy, setPhotoBusy] = useState(false);
  const [carryBusy, setCarryBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const member = useMemo(() => allUsers.find((u) => u.id === userId), [allUsers, userId]);
  const activeUsers: User[] = useMemo(
    () => allUsers.filter((u) => u.active).sort((a, b) => a.displayName.localeCompare(b.displayName, lang)),
    [allUsers, lang],
  );
  const rockById = useMemo(() => new Map(allRocks.map((r): [string, Rock] => [r.id, r])), [allRocks]);
  const prioById = useMemo(() => new Map(allPriorities.map((p): [string, AlignPriority] => [p.id, p])), [allPriorities]);

  // Keyboard: Alt+Left / Alt+Right go to the previous / next member.
  const { prevId, nextId, hrefFor } = nav;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === 'ArrowLeft' && prevId) {
        e.preventDefault();
        navigate(hrefFor(prevId));
      } else if (e.key === 'ArrowRight' && nextId) {
        e.preventDefault();
        navigate(hrefFor(nextId));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prevId, nextId, hrefFor, navigate]);

  // Priorities of the member for the selected quarter (same rule as everywhere: lib.ts priorityInQuarter).
  const myPriorities = useMemo(
    () => allPriorities.filter((p) => p.ownerId === userId && priorityInQuarter(p, quarter, rockById)).sort(prioritySort),
    [allPriorities, userId, quarter, rockById],
  );
  const openPrioCount = myPriorities.filter((p) => p.status !== 'completed').length;
  const followupsBy = useMemo(() => {
    const m = groupBy(
      allNotes.filter((n: AlignNote) => n.kind === 'followup'),
      (n) => n.priorityId,
    );
    for (const list of m.values()) list.sort((a, b) => Number(a.done) - Number(b.done) || byDue(a, b));
    return m;
  }, [allNotes]);

  // Plan d'action: this week's tasks of the member, last week's open ones, and the Rocks of the quarter.
  const weekTasks = useMemo(() => allTasks.filter((x) => x.ownerId === userId && x.weekStart === week), [allTasks, userId, week]);
  const prevOpen = useMemo(
    () => allTasks.filter((x) => x.ownerId === userId && x.weekStart === prevWeek && !x.done),
    [allTasks, userId, prevWeek],
  );
  const openTaskCount = weekTasks.filter((x) => !x.done).length;
  const nextOrder = weekTasks.reduce((m, x) => Math.max(m, x.order + 1), 0);
  const ownPriorities = useMemo(() => allPriorities.filter((p) => p.ownerId === userId && !p.archived), [allPriorities, userId]);
  const quarterRocks = useMemo(
    () => allRocks.filter((r) => r.quarter === quarter && !r.archived).sort((a, b) => a.order - b.order),
    [allRocks, quarter],
  );

  const checkin = allCheckins.find((c) => c.id === checkinId(userId, week));
  const lastWhatsUp = allCheckins.find((c) => c.id === checkinId(userId, prevWeek))?.whatsUp ?? '';

  async function carryOver() {
    const titles = new Set(weekTasks.map((x) => x.title.trim().toLowerCase()));
    // A Rock action whose Rock was deleted cannot be stored again: it is left behind.
    const copy = prevOpen.filter(
      (x) => !titles.has(x.title.trim().toLowerCase()) && (x.kind === 'weekly' || (x.rockId !== null && rockById.has(x.rockId))),
    );
    if (!copy.length) {
      toast(t('Rien à reporter', 'Nothing to carry over'));
      return;
    }
    setCarryBusy(true);
    try {
      let order = nextOrder;
      for (const x of copy) {
        await tasks.insert({
          id: uid('t_'),
          title: x.title,
          ownerId: userId,
          weekStart: week,
          kind: x.kind,
          rockId: x.kind === 'rock' ? x.rockId : null,
          priorityId: x.priorityId && prioById.has(x.priorityId) ? x.priorityId : null,
          done: false,
          huddleId,
          order: order++,
        });
      }
      toast(t(`${copy.length} tâche(s) reportée(s)`, `${copy.length} task(s) carried over`));
    } catch (err) {
      toast(errorText(err), 'err');
    } finally {
      setCarryBusy(false);
    }
  }

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !member) return;
    if (!file.type.startsWith('image/')) {
      toast(t('Choisissez une image', 'Choose an image'), 'err');
      return;
    }
    setPhotoBusy(true);
    try {
      const photo = await squarePhoto(file);
      await users.update(member.id, { photo });
      toast(t('Photo mise à jour', 'Photo updated'));
    } catch (err) {
      toast(errorText(err), 'err');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    if (!member) return;
    setPhotoBusy(true);
    try {
      await users.update(member.id, { photo: '' });
      toast(t('Photo retirée', 'Photo removed'));
    } catch (err) {
      toast(errorText(err), 'err');
    } finally {
      setPhotoBusy(false);
    }
  }

  if (!member) {
    if (loadingUsers) return null;
    return (
      <Page>
        <div className="card">
          <Empty icon={<Users size={36} />} title={t('Membre introuvable', 'Member not found')}>
            <Link to={nav.backTo}>{nav.backLabel}</Link>
          </Empty>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <div className="align-member-top">
        <Link to={nav.backTo} className="align-member-back">
          <ArrowLeft size={16} /> {nav.backLabel}
        </Link>
        <nav className="align-member-nav" aria-label={t('Autres membres', 'Other members')}>
          {nav.prevId ? (
            <Link to={hrefFor(nav.prevId)} className="align-member-step" title={t('Membre précédent (Alt+←)', 'Previous member (Alt+←)')}>
              <ChevronLeft size={16} /> {userName(nav.prevId)}
            </Link>
          ) : (
            <span className="align-member-step is-off" aria-disabled="true">
              <ChevronLeft size={16} />
            </span>
          )}
          <span className="faint">|</span>
          {nav.nextId ? (
            <Link to={hrefFor(nav.nextId)} className="align-member-step" title={t('Membre suivant (Alt+→)', 'Next member (Alt+→)')}>
              {userName(nav.nextId)} <ChevronRight size={16} />
            </Link>
          ) : (
            <span className="align-member-step is-off" aria-disabled="true">
              <ChevronRight size={16} />
            </span>
          )}
        </nav>
      </div>

      <div className="card card-pad align-member-head">
        <MemberAvatar user={member} size={64} />
        <div className="stack" style={{ gap: 4, minWidth: 0 }}>
          <h1 className="align-member-name">
            {member.displayName} {isMe && <span className="badge">{t('Moi', 'Me')}</span>}
          </h1>
          {huddleId && nav.huddleName && <span className="small muted">{nav.huddleName}</span>}
        </div>
        {canPhoto && (
          <div className="row row-wrap align-member-photo-actions">
            <button className="btn btn-sm" disabled={photoBusy} onClick={() => fileRef.current?.click()}>
              <Camera size={14} /> {isMe ? t('Changer ma photo', 'Change my photo') : t('Changer la photo', 'Change photo')}
            </button>
            {member.photo && (
              <button className="btn btn-ghost btn-sm" disabled={photoBusy} onClick={() => void removePhoto()}>
                <Trash2 size={14} /> {t('Retirer', 'Remove')}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onPhoto(e)} />
          </div>
        )}
      </div>

      <div style={{ margin: '16px 0' }}>
        <WeekPicker week={week} onChange={setWeek} />
      </div>

      <div className="stack" style={{ gap: 16 }}>
        <Collapsible id="member.whatsup" title={t('Quoi de neuf ?', "What's up?")} icon={<MessageSquare size={16} />}>
          <WhatsUp userId={userId} week={week} checkin={checkin} canEdit={canEdit} lastWhatsUp={lastWhatsUp} userName={userName} />
        </Collapsible>

        <Collapsible
          id="member.priorities"
          title={t('Priorités de la semaine', "This week's priorities")}
          icon={<ListChecks size={16} />}
          count={openPrioCount}
        >
          {!myPriorities.length ? (
            <Empty icon={<ListChecks size={28} />} title={t('Aucune priorité pour ce trimestre', 'No priorities for this quarter')} />
          ) : (
            <div className="align-person-body">
              {myPriorities.map((p) => (
                <PriorityRow
                  key={p.id}
                  priority={p}
                  rockTitle={p.rockId ? rockById.get(p.rockId)?.title : undefined}
                  blockerTitle={p.blockedById ? prioById.get(p.blockedById)?.title : undefined}
                  blocked={isBlocked(p, prioById)}
                  overdue={isOverdue(p)}
                  followups={followupsBy.get(p.id) ?? []}
                  huddleId={huddleId}
                  people={activeUsers}
                  userName={userName}
                />
              ))}
            </div>
          )}
        </Collapsible>

        <Collapsible id="member.plan" title={t("Plan d'action", 'Action plan')} icon={<ListTodo size={16} />} count={openTaskCount}>
          {canEdit && (
            <TaskComposer ownerId={userId} week={week} huddleId={huddleId} rocks={quarterRocks} priorities={ownPriorities} nextOrder={nextOrder} />
          )}
          {prevOpen.length > 0 && (
            <div className="row row-wrap align-carry">
              <span className="small muted">
                {t(`${prevOpen.length} tâche(s) non terminée(s) la semaine précédente`, `${prevOpen.length} unfinished task(s) last week`)}
              </span>
              {canEdit && (
                <button className="btn btn-sm" disabled={carryBusy} onClick={() => void carryOver()}>
                  {t('Reporter à cette semaine', 'Carry over')}
                </button>
              )}
            </div>
          )}
          <TaskList tasks={weekTasks} rockById={rockById} priorityById={prioById} emptyText={t('Aucune action pour cette semaine', 'No action for this week')} />
        </Collapsible>
      </div>
    </Page>
  );
}
