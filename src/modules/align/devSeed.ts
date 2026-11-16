/**
 * Demo data for the browser dev backend only (never used by the API server): the quarter's company priorities from
 * Pubco's 4D Vision summary as Rocks, with a few priorities assigned to the demo accounts.
 */
import { quarterOf, quarterRange } from './lib';
import type { AlignHuddle, AlignNote, AlignPriority, Rock } from './schemas';
import { alignHuddles, alignPriorities, notes, rocks } from './stores';

const KEY = 'imago:seed:align:v2';

export async function ensureAlignSeeded(force = false) {
  if (!force && localStorage.getItem(KEY) === '1') return;
  const q = quarterOf();
  const end = quarterRange(q).end;
  const mid = `${end.slice(0, 7)}-01`;

  const rock = (id: string, title: string, description: string, ownerId: string, thrust: number, order: number, initiative: number): Rock => ({
    id, title, description, ownerId, quarter: q, thrust, initiative, order, archived: false, sourceId: null,
  });
  const R: Rock[] = [
    rock('rock_demo1', 'Déployer la revue hebdomadaire des marges et des écarts des projets terminés', 'Chaque projet terminé est revu la semaine suivante : marge réelle vs soumise, causes des écarts.', 'u_compta', 1, 0, 0),
    rock('rock_demo2', 'Atteindre 100 % de dossiers complets avant le démarrage des nouveaux projets', 'Aucun projet ne démarre sans dossier complet (devis signé, devis matières, échéancier).', 'u_admin', 2, 1, 1),
    rock('rock_demo3', 'Planifier 100 % des commandes à produire sur les quatre prochaines semaines', 'Planification commune Pubco–Montech, visible par tous.', 'u_prod', 3, 2, 1),
    rock('rock_demo4', 'Rendre opérationnel le tableau de bord hebdomadaire de chaque département', 'Chaque département suit ses indicateurs dans Imago et les revoit en huddle.', 'u_admin', 4, 3, 4),
  ];

  let n = 0;
  const prio = (rockId: string | null, title: string, ownerId: string, status: AlignPriority['status'], health: AlignPriority['health'], progress: number, dueDate: string, blockedById: string | null = null, blockedNote = ''): AlignPriority => ({
    id: `prio_demo${++n}`, rockId, title, description: '', ownerId, dueDate, status, health, progress, blockedById, blockedNote, order: n, archived: false, sourceId: null,
  });
  const P: AlignPriority[] = [
    prio('rock_demo1', 'Définir le gabarit de revue de marge', 'u_compta', 'completed', 'green', 100, mid),
    prio('rock_demo1', 'Extraire les coûts réels de Business Central par projet', 'u_compta', 'in_progress', 'yellow', 60, end),
    prio('rock_demo1', 'Planifier la revue du lundi avec les chargés de projet', 'u_admin', 'not_started', 'green', 0, end),
    prio('rock_demo2', 'Liste de vérification du dossier de démarrage', 'u_admin', 'completed', 'green', 100, mid),
    prio('rock_demo2', 'Former les chargés de projet à la liste', 'u_prod', 'in_progress', 'green', 40, end),
    prio('rock_demo3', 'Calendrier de production commun Pubco–Montech', 'u_prod', 'in_progress', 'red', 30, end),
    prio('rock_demo3', 'Saisie des commandes confirmées sous 24 h', 'u_compta', 'not_started', 'yellow', 0, end, 'prio_demo6', 'Attend le calendrier commun'),
    prio('rock_demo4', 'Indicateurs de la production dans Imago', 'u_prod', 'completed', 'green', 100, mid),
    prio('rock_demo4', 'Indicateurs de la comptabilité dans Imago', 'u_compta', 'completed', 'green', 100, mid),
    prio(null, 'Mettre à jour la procédure d’expédition', 'u_prod', 'in_progress', 'green', 50, end),
  ];

  const N: AlignNote[] = [
    { id: 'note_demo1', priorityId: 'prio_demo2', kind: 'note', text: 'Les coûts de main-d’œuvre arrivent avec une semaine de décalage.', assigneeId: null, dueDate: null, done: false, huddleId: null, sourceId: null },
    { id: 'note_demo2', priorityId: 'prio_demo2', kind: 'followup', text: 'Valider le rapport BC avec le contrôleur', assigneeId: 'u_compta', dueDate: mid, done: false, huddleId: null, sourceId: null },
    { id: 'note_demo3', priorityId: 'prio_demo6', kind: 'followup', text: 'Rencontre de planification avec Montech', assigneeId: 'u_prod', dueDate: end, done: false, huddleId: null, sourceId: null },
  ];

  const H: AlignHuddle[] = [
    { id: 'hud_demo1', name: 'Huddle de direction', description: 'Revue hebdomadaire des Rocks et des priorités.', ownerId: 'u_admin', memberIds: ['u_admin', 'u_compta', 'u_prod'], cadence: 'weekly', dayOfWeek: 1, startTime: '08:30', endTime: '09:00', videoUrl: '', active: true, sourceId: null },
  ];

  await rocks.replaceAll(R);
  await alignPriorities.replaceAll(P);
  await notes.replaceAll(N);
  await alignHuddles.replaceAll(H);
  localStorage.setItem(KEY, '1');
}
