import { Fragment, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, RotateCcw, Send, Square } from 'lucide-react';
import { API_MODE, ApiError, uid } from '@/data/db';
import { useI18n } from '@/i18n';
import { AiUsageChip } from '@/components/AiUsageChip';
import type { HelpTopic } from '@/help/types';
import { answerDemo, askAssistant, type ChatMsg, type PageRef } from './assistantApi';
import './assistant.css';

const MAX_CHARS = 2000;
const MAX_TURNS = 12;
const KEEP = 40;
const STORE = 'imago:assistant:';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Answered locally, without the server. */
  demo?: boolean;
}

interface Props {
  scope: 'page' | 'app';
  page: PageRef;
  /** Help topics the answers and suggested questions come from, most relevant first. */
  topics: HelpTopic[];
  /** Conversation key: one conversation per tab and per surface. */
  storageKey: string;
}

function loadMessages(key: string): Msg[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(STORE + key) ?? '[]') as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter((m): m is Msg => !!m && typeof m.id === 'string' && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
      .slice(-KEEP);
  } catch {
    return [];
  }
}

function saveMessages(key: string, list: Msg[]) {
  try {
    sessionStorage.setItem(STORE + key, JSON.stringify(list.slice(-KEEP)));
  } catch {
    /* storage unavailable: the conversation lasts for this view only */
  }
}

/** A same-origin relative path such as /sales/requests: the only links the answer may make clickable. */
const isSafePath = (s: string) => /^\/(?!\/)[A-Za-z0-9_\-./]*[A-Za-z0-9_\-]$/.test(s);

const INLINE = /\*\*([^*\n]+)\*\*|`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]+)\)|(?:^|(?<=[\s(]))(\/[A-Za-z0-9_\-./]*[A-Za-z0-9_\-])/g;

/** Bold, code, links. Everything else is plain text (React escapes it); no HTML is ever injected. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    const key = String(at);
    if (at > last) out.push(text.slice(last, at));
    if (m[1] !== undefined) {
      out.push(<strong key={key}>{m[1]}</strong>);
    } else if (m[2] !== undefined) {
      out.push(<code key={key}>{m[2]}</code>);
    } else if (m[3] !== undefined) {
      const url = m[4];
      out.push(isSafePath(url) ? <Link key={key} to={url}>{m[3]}</Link> : <Fragment key={key}>{`${m[3]} (${url})`}</Fragment>);
    } else if (isSafePath(m[5])) {
      out.push(<Link key={key} to={m[5]}>{m[5]}</Link>);
    } else {
      out.push(m[5]);
    }
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Paragraphs, line breaks, numbered and bulleted lists. */
function renderAnswer(text: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flushPara = () => {
    if (!para.length) return;
    blocks.push(
      <p key={blocks.length}>
        {para.map((line, i) => (
          <Fragment key={i}>
            {i > 0 && <br />}
            {inline(line)}
          </Fragment>
        ))}
      </p>,
    );
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(
      <Tag key={blocks.length}>
        {list.items.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };

  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    const ul = /^[-*•]\s+(.*)$/.exec(line);
    if (ol || ul) {
      flushPara();
      const ordered = !!ol;
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push((ol ?? ul)![1]);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}

/**
 * Chat with the assistant: messages, input, typing indicator, retry, copy, new conversation.
 * Without a server (API_MODE off) the answers come from the help content, labelled as demo.
 */
export function AssistantChat({ scope, page, topics, storageKey }: Props) {
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState<Msg[]>(() => loadMessages(storageKey));
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ text: string; retry: boolean } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  // Each request gets a number; a stopped or abandoned request's answer is ignored.
  const reqRef = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveMessages(storageKey, messages);
  }, [storageKey, messages]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages.length, sending, error]);

  useEffect(
    () => () => {
      reqRef.current++;
    },
    [],
  );

  const suggestions = topics.flatMap((tp) => tp.howTo.map((h) => h.q[lang])).slice(0, 4);

  const errorFor = (e: unknown): { text: string; retry: boolean } => {
    if (e instanceof ApiError) {
      if (e.status === 429)
        return {
          // The server's message explains the quota; a bare code gets the generic wording.
          text: /\s/.test(e.message)
            ? e.message
            : t('Vous avez atteint votre quota d’IA pour le moment. Réessayez plus tard.', 'You have reached your AI quota for now. Try again later.'),
          retry: false,
        };
      if (e.status === 503)
        return {
          text: t(
            'L’assistant n’est pas configuré pour cette organisation. Demandez à un administrateur de l’activer.',
            'The assistant is not set up for this organisation. Ask an administrator to turn it on.',
          ),
          retry: false,
        };
      if (e.status === 502) return { text: t('Le service d’IA n’a pas répondu. Réessayez.', 'The AI service did not respond. Try again.'), retry: true };
    }
    return { text: t('Impossible de joindre l’assistant. Vérifiez la connexion et réessayez.', 'Could not reach the assistant. Check your connection and try again.'), retry: true };
  };

  /** Asks for an answer to the conversation `list` (its last message is the user's question). */
  const ask = (list: Msg[]) => {
    const id = ++reqRef.current;
    setSending(true);
    setError(null);
    const wire: ChatMsg[] = list.slice(-MAX_TURNS).map(({ role, content }) => ({ role, content }));
    while (wire.length && wire[0].role !== 'user') wire.shift();
    const question = list[list.length - 1].content;
    const run: Promise<string> = API_MODE
      ? askAssistant(wire, page, scope)
      : new Promise((resolve) => setTimeout(() => resolve(answerDemo(question, topics, lang)), 450));

    run.then(
      (reply) => {
        if (id !== reqRef.current) return;
        setMessages((m) => [...m, { id: uid('a-'), role: 'assistant', content: reply, demo: !API_MODE }]);
        setAnnounce(reply.slice(0, 300));
        setSending(false);
      },
      (e: unknown) => {
        if (id !== reqRef.current) return;
        setError(errorFor(e));
        setSending(false);
      },
    );
  };

  const send = (raw: string) => {
    const content = raw.trim();
    if (!content || sending) return;
    const next: Msg[] = [...messages, { id: uid('u-'), role: 'user', content: content.slice(0, MAX_CHARS) }];
    setMessages(next);
    setInput('');
    ask(next);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter starts a new line; Enter that confirms an IME composition does not send.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  };

  const stop = () => {
    reqRef.current++;
    setSending(false);
  };

  const newConversation = () => {
    reqRef.current++;
    setMessages([]);
    setInput('');
    setSending(false);
    setError(null);
    try {
      sessionStorage.removeItem(STORE + storageKey);
    } catch {
      /* nothing stored */
    }
  };

  const copy = async (m: Msg) => {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopied(m.id);
      setTimeout(() => setCopied((c) => (c === m.id ? null : c)), 1500);
    } catch {
      /* clipboard refused: nothing to do */
    }
  };

  return (
    <div className="ai-chat">
      <div className="ai-toolbar">
        <span className="spacer" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={newConversation} disabled={!messages.length && !error}>
          <RotateCcw size={14} /> {t('Nouvelle conversation', 'New conversation')}
        </button>
      </div>

      <div className="ai-log" ref={logRef}>
        {messages.length === 0 && !sending && (
          <p className="ai-empty muted small">{t('Posez une question sur cette page ou sur Imago.', 'Ask a question about this page or about Imago.')}</p>
        )}
        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="ai-msg ai-msg-user">
              {m.content}
            </div>
          ) : (
            <div key={m.id} className="ai-msg ai-msg-assistant">
              {m.demo && <span className="ai-demo-tag">{t('Démo', 'Demo')}</span>}
              <div className="ai-prose">{renderAnswer(m.content)}</div>
              <button
                type="button"
                className="btn btn-ghost btn-sm ai-copy"
                onClick={() => copy(m)}
                aria-label={t('Copier la réponse', 'Copy answer')}
              >
                {copied === m.id ? <Check size={14} /> : <Copy size={14} />}
                {copied === m.id ? t('Copié', 'Copied') : t('Copier', 'Copy')}
              </button>
            </div>
          ),
        )}
        {sending && (
          <div className="ai-msg ai-msg-assistant ai-typing" aria-label={t('L’assistant écrit…', 'The assistant is typing…')}>
            <span />
            <span />
            <span />
          </div>
        )}
        {error && (
          <div className="ai-error" role="alert">
            <span>{error.text}</span>
            {error.retry && (
              <button type="button" className="btn btn-sm" onClick={() => ask(messages)}>
                <RotateCcw size={14} /> {t('Réessayer', 'Retry')}
              </button>
            )}
          </div>
        )}
      </div>

      {messages.length === 0 && suggestions.length > 0 && (
        <div className="ai-chips">
          {suggestions.map((q) => (
            <button key={q} type="button" className="ai-chip" onClick={() => send(q)} disabled={sending}>
              {q}
            </button>
          ))}
        </div>
      )}

      <form className="ai-input" onSubmit={onSubmit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={MAX_CHARS}
          rows={2}
          placeholder={t('Votre question…', 'Your question…')}
          aria-label={t('Votre question', 'Your question')}
        />
        <div className="ai-input-foot">
          <span className={`ai-count ${input.length > MAX_CHARS * 0.9 ? 'near' : ''}`}>
            {input.length} / {MAX_CHARS}
          </span>
          {sending ? (
            <button type="button" className="btn btn-sm" onClick={stop}>
              <Square size={13} /> {t('Arrêter', 'Stop')}
            </button>
          ) : (
            <button type="submit" className="btn btn-primary btn-sm" disabled={!input.trim()}>
              <Send size={14} /> {t('Envoyer', 'Send')}
            </button>
          )}
        </div>
      </form>

      <div className="ai-foot">
        <p className="ai-note">{t('L’assistant ne répond que sur ce que votre accès permet.', 'The assistant only answers about what your access allows.')}</p>
        <AiUsageChip />
      </div>
      <div className="ai-sr-only" role="status" aria-live="polite">
        {announce}
      </div>
    </div>
  );
}
