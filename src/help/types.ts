/**
 * In-app help: what each page is for, quick tips and common how-to answers. One source for the "How it works"
 * panel (browser) and the AI assistant (server), so both only ever describe what the signed-in user may open.
 * Pure types and functions: imported by the Node server too (no browser APIs, no '@/' alias value imports).
 */

export interface Bi {
  fr: string;
  en: string;
}

export interface HelpTopic {
  id: string;
  /** Module id from the registry ('sales', 'estimating', 'accounting'...), or 'app' for the shell (menu, theme, language). */
  module: string;
  /** The route it explains, e.g. '/sales' or '/sales/requests/new'. Longest prefix wins; ':id' matches one segment. */
  path: string;
  /** Permission needed to open the page ('' = any signed-in user). The same key the page uses. */
  permission: string;
  title: Bi;
  /** What the page is for, in one or two sentences. */
  summary: Bi;
  /** 3 to 6 quick tips shown when the panel opens. */
  tips: Bi[];
  /** Common questions with a short answer. */
  howTo: { q: Bi; a: Bi }[];
  keywords: string[];
}

const segs = (p: string) => p.split('?')[0].split('#')[0].split('/').filter(Boolean);

/** The topic describing a URL path: the one with the most matching leading segments. */
export function topicForPath(pathname: string, topics: HelpTopic[]): HelpTopic | undefined {
  const path = segs(pathname);
  let best: HelpTopic | undefined;
  let bestLen = -1;
  for (const t of topics) {
    const ts = segs(t.path);
    if (ts.length > path.length) continue;
    if (ts.every((s, i) => s === ':id' || s === path[i]) && ts.length > bestLen) {
      best = t;
      bestLen = ts.length;
    }
  }
  return best;
}

/** Only the topics a user may see. `can` is the same permission check the pages use. */
export const visibleTopics = (topics: HelpTopic[], can: (permission: string) => boolean): HelpTopic[] => topics.filter((t) => !t.permission || can(t.permission));
