import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FileText, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { KPI_TOUR_STEPS } from './steps';
import './tour.css';

/** How long a step waits for its target to render after a route change. */
const WAIT_MS = 2000;
/** Space between the spotlight and its target. */
const PAD = 8;
/** Space between the target and the card. */
const GAP = 14;
/** Minimum distance from the viewport edges. */
const EDGE = 16;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** The target when it exists and is rendered (zero-size elements count as missing). */
function findTarget(selector?: string): HTMLElement | null {
  if (!selector) return null;
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
}

function boxOf(el: HTMLElement | null): Box | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function sameBox(a: Box | null, b: Box | null): boolean {
  if (a === b) return true;
  return !!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, max));

/**
 * Guided tour of the KPI tool: a dimmed backdrop with a spotlight on the target element,
 * and a card next to it. Steps can open their own route first.
 */
export function KpiTour({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [viewTick, setViewTick] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  /** Last step whose route was requested, so a redirect cannot make the tour loop. */
  const navigatedFor = useRef(-1);

  const total = KPI_TOUR_STEPS.length;
  const step = KPI_TOUR_STEPS[index];
  const isLast = index === total - 1;

  const next = () => (isLast ? onClose() : setIndex((i) => i + 1));
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  // Open the step's route, then wait for its target before measuring.
  useEffect(() => {
    setReady(false);
    if (step.route && pathname !== step.route && navigatedFor.current !== index) {
      navigatedFor.current = index;
      navigate(step.route);
      return;
    }
    let cancelled = false;
    let timer = 0;
    let scrolled = false;
    const started = performance.now();
    const check = () => {
      if (cancelled) return;
      const el = findTarget(step.target);
      if (el && !scrolled) {
        scrolled = true;
        el.scrollIntoView({ block: 'center' });
      }
      if (!step.target || el || performance.now() - started > WAIT_MS) {
        setReady(true);
        return;
      }
      timer = window.setTimeout(check, 60);
    };
    check();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [index, pathname, navigate, step]);

  // Follow the target every frame, so scrolling, animations and resizes keep the spotlight in place.
  useEffect(() => {
    let frame = 0;
    const loop = () => {
      const latest = boxOf(findTarget(step.target));
      setBox((prevBox) => (sameBox(prevBox, latest) ? prevBox : latest));
      frame = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frame);
  }, [step]);

  useEffect(() => {
    const onResize = () => setViewTick((n) => n + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Place the card below the target, above it if there is no room, and keep it inside the viewport.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || !ready) return;
    const { width: cw, height: ch } = card.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let next: { top: number; left: number };
    if (!box) {
      next = { top: (vh - ch) / 2, left: (vw - cw) / 2 };
    } else {
      const left = clamp(box.left + box.width / 2 - cw / 2, EDGE, vw - cw - EDGE);
      const below = box.top + box.height + GAP;
      const above = box.top - GAP - ch;
      let top: number;
      if (below + ch <= vh - EDGE) top = below;
      else if (above >= EDGE) top = above;
      else top = box.top + box.height / 2 > vh / 2 ? EDGE : vh - ch - EDGE;
      next = { top: clamp(top, EDGE, vh - ch - EDGE), left };
    }
    setPos((prevPos) =>
      prevPos && prevPos.top === next.top && prevPos.left === next.left ? prevPos : next,
    );
  }, [ready, box, index, viewTick]);

  useEffect(() => {
    if (ready) nextRef.current?.focus({ preventScroll: true });
  }, [ready, index]);

  // Keyboard: Esc closes, arrows and Enter move between steps. Typing and focused buttons keep their own keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || (e.key === 'Enter' && !el?.closest('button, a'))) next();
      else if (e.key === 'ArrowLeft') prev();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // next/prev only depend on isLast and setIndex, both covered here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, isLast]);

  const spot = ready && box ? { top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 } : null;

  return createPortal(
    <div className="tour-layer" role="dialog" aria-modal="true" aria-label={t('Visite guidée de l’outil KPI', 'KPI tool guided tour')}>
      <div className={`tour-blocker ${spot ? '' : 'dim'}`} />
      {spot && <div className="tour-spot" style={spot} />}
      {ready && (
        <div
          key={index}
          ref={cardRef}
          className="tour-card"
          style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }}
        >
          <div className="tour-head">
            <span className="tour-count">
              {t('Étape', 'Step')} {index + 1} / {total}
            </span>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label={t('Fermer la visite', 'Close tour')}>
              <X size={16} />
            </button>
          </div>
          <h3 className="tour-title">{t(step.title)}</h3>
          <p className="tour-body">{t(step.body)}</p>
          {step.link && (
            <a className="tour-link" href={step.link.href} target="_blank" rel="noreferrer">
              <FileText size={15} /> {t(step.link.label)}
            </a>
          )}
          <div className="tour-foot">
            <button type="button" className="btn btn-ghost btn-sm tour-skip" onClick={onClose}>
              {t('Passer la visite', 'Skip tour')}
            </button>
            <div className="tour-nav">
              <button type="button" className="btn btn-sm" onClick={prev} disabled={index === 0}>
                <ChevronLeft size={15} /> {t('Précédent', 'Previous')}
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={next} ref={nextRef}>
                {isLast ? t('Terminer', 'Finish') : t('Suivant', 'Next')}
                {!isLast && <ChevronRight size={15} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
