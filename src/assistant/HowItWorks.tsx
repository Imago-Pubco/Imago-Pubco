import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CircleHelp, Eye, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { HOME_ACCENT, moduleForPath } from '@/modules/registry';
import { AssistantChat } from './AssistantChat';
import { usePageHelp } from './helpTopics';
import { useHelperHidden } from './helperState';
import './assistant.css';

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';

/** Top-bar button "Comment ça marche" and the right-side drawer it opens. */
export function HowItWorks() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const label = t('Comment ça marche', 'How it works');
  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-sm help-btn"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        <CircleHelp size={18} />
        <span className="help-btn-text">{label}</span>
      </button>
      {createPortal(<AnimatePresence>{open && <HelpDrawer onClose={() => setOpen(false)} />}</AnimatePresence>, document.body)}
    </>
  );
}

function HelpDrawer({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const { pathname } = useLocation();
  const { pageTopic, appTopics, chatTopics } = usePageHelp();
  const [hidden, setHidden] = useHelperHidden();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Kept in a ref so the effect below runs once per opening, not on every parent render.
  const closeLater = useRef(onClose);
  closeLater.current = onClose;

  // Escape closes; focus goes back to the button that opened the drawer.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && closeLater.current();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, []);

  // Focus stays inside the drawer while it is open.
  const onTrap = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Tab' || !ref.current) return;
    const els = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!els.length) return;
    const first = els[0];
    const last = els[els.length - 1];
    const active = document.activeElement;
    const inside = !!active && ref.current.contains(active);
    if (e.shiftKey && (active === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  };

  // Without a page topic, the drawer shows the general topics.
  const head = pageTopic
    ? { title: pageTopic.title[lang], summary: pageTopic.summary[lang], tips: pageTopic.tips }
    : {
        title: t('Aide générale', 'General help'),
        summary: t('Aucune aide précise pour cette page. Voici les questions générales sur Imago.', 'No specific help for this page. Here are the general questions about Imago.'),
        tips: [],
      };
  const faq = pageTopic ? pageTopic.howTo : appTopics.flatMap((tp) => tp.howTo);
  const accent = moduleForPath(pathname)?.accent ?? HOME_ACCENT;
  const fade = { duration: reduce ? 0 : 0.2 };

  return (
    <>
      <motion.div
        className="help-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={fade}
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      />
      <motion.aside
        ref={ref}
        className="help-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-drawer-title"
        style={{ ['--accent' as string]: accent }}
        initial={{ x: reduce ? 0 : '100%' }}
        animate={{ x: 0 }}
        exit={{ x: reduce ? 0 : '100%' }}
        transition={{ duration: reduce ? 0 : 0.3, ease: [0.2, 0.7, 0.2, 1] }}
        onKeyDown={onTrap}
      >
        <div className="help-drawer-head">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="eyebrow">{t('Comment ça marche', 'How it works')}</div>
            <h2 id="help-drawer-title" className="help-drawer-title">
              {head.title}
            </h2>
          </div>
          <button ref={closeRef} type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label={t('Fermer', 'Close')}>
            <X size={18} />
          </button>
        </div>

        <div className="help-drawer-body">
          <p className="help-summary">{head.summary}</p>

          {head.tips.length > 0 && (
            <section>
              <h3 className="help-section-title">{t('Conseils', 'Tips')}</h3>
              <ul className="help-tips">
                {head.tips.map((tip, i) => (
                  <li key={i}>{tip[lang]}</li>
                ))}
              </ul>
            </section>
          )}

          {faq.length > 0 && (
            <section>
              <h3 className="help-section-title">{t('Questions fréquentes', 'Frequently asked questions')}</h3>
              {faq.map((h, i) => (
                <details key={i} className="help-faq">
                  <summary>{h.q[lang]}</summary>
                  <p>{h.a[lang]}</p>
                </details>
              ))}
            </section>
          )}

          {hidden && (
            <button type="button" className="btn btn-sm" onClick={() => setHidden(false)} style={{ alignSelf: 'flex-start' }}>
              <Eye size={15} /> {t('Réafficher l’assistant', 'Show the assistant')}
            </button>
          )}

          <section>
            <h3 className="help-section-title">{t('Poser une question', 'Ask a question')}</h3>
            <div className="help-chat-wrap">
              <AssistantChat scope="page" page={{ path: pathname, title: head.title }} topics={chatTopics} storageKey="page" />
            </div>
          </section>
        </div>
      </motion.aside>
    </>
  );
}
