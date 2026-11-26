/** Calls to the assistant server, and the local answers used when there is no server (browser / dev mode). */
import { api } from '@/data/db';
import type { Lang } from '@/data/types';
import type { HelpTopic } from '@/help/types';

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export interface PageRef {
  path: string;
  title?: string;
}

/** POST /assistant/chat. Errors come back as ApiError (429, 503 'ai_off' / 'assistant_unsupported', 502 'ai_failed'). */
export async function askAssistant(messages: ChatMsg[], page: PageRef, scope: 'page' | 'app'): Promise<string> {
  const r = await api<{ reply: string; tools?: string[] }>('/assistant/chat', { method: 'POST', body: { messages, page, scope } });
  return r.reply;
}

// Words that carry no meaning for matching a question to a how-to.
const STOP = new Set(['les', 'des', 'une', 'est', 'pour', 'dans', 'avec', 'sur', 'que', 'qui', 'quoi', 'mon', 'mes', 'vos', 'votre', 'comment', 'peux', 'puis', 'quel', 'quelle', 'the', 'and', 'how', 'can', 'what', 'where', 'pas', 'aux', 'par', 'does', 'and']);

/** Lower-cased, accent-free words of a text, without stop words. */
function words(s: string): Set<string> {
  const plain = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return new Set(plain.split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)));
}

/**
 * Demo answer without a server: the how-to whose wording overlaps the question the most, or the tips of the
 * page when nothing matches. `topics` are already limited to what the user may see.
 */
export function answerDemo(question: string, topics: HelpTopic[], lang: Lang): string {
  const q = words(question);
  let best: { score: number; answer: string } | null = null;
  for (const topic of topics) {
    for (const h of topic.howTo) {
      const doc = words([h.q.fr, h.q.en, h.a.fr, h.a.en, topic.keywords.join(' ')].join(' '));
      let score = 0;
      q.forEach((w) => doc.has(w) && score++);
      if (score > 0 && (!best || score > best.score)) best = { score, answer: h.a[lang] };
    }
  }
  // One strong word is enough for a one-word question; otherwise require two matches.
  if (best && best.score >= Math.min(2, q.size)) return best.answer;

  const tips = topics[0]?.tips.map((tip) => `- ${tip[lang]}`).join('\n') ?? '';
  const intro =
    lang === 'fr'
      ? "En mode démo, l'assistant IA n'est pas disponible; voici les conseils de cette page."
      : 'Demo mode: the AI assistant is not available here. Here are the tips for this page.';
  return tips ? `${intro}\n\n${tips}` : intro;
}
