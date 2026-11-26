import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { EllipsisVertical, EyeOff, Minimize2 } from 'lucide-react';
import { BrandLogo } from '@/branding/BrandLogo';
import { useI18n } from '@/i18n';
import { AssistantChat } from './AssistantChat';
import { usePageHelp } from './helpTopics';
import { useHelperHidden } from './helperState';
import './assistant.css';

const POS_KEY = 'imago:helper:pos';
const SIZE = 48;
const MARGIN = 16;
const GAP = 12;
const DRAG_THRESHOLD = 5;
const POP_W = 380;
const POP_H = 520;

/** Position as percentages of the free travel inside the viewport, so it stays in place across resizes. */
interface Pos {
  x: number;
  y: number;
}
interface Px {
  left: number;
  top: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function readPos(): Pos {
  try {
    const v = JSON.parse(localStorage.getItem(POS_KEY) ?? 'null') as Partial<Pos> | null;
    if (v && typeof v.x === 'number' && typeof v.y === 'number') return { x: clamp(v.x, 0, 100), y: clamp(v.y, 0, 100) };
  } catch {
    /* no saved position */
  }
  return { x: 100, y: 100 }; // bottom-right
}

function writePos(p: Pos) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: this session only */
  }
}

/** The icon never goes under the top bar (it would hide its buttons) nor out of the viewport. */
function bounds(vw: number, vh: number) {
  const topbar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 60;
  const minTop = topbar + 8;
  return {
    minLeft: MARGIN,
    maxLeft: Math.max(MARGIN, vw - SIZE - MARGIN),
    minTop,
    maxTop: Math.max(minTop, vh - SIZE - MARGIN),
  };
}

function toPx(p: Pos, vw: number, vh: number): Px {
  const b = bounds(vw, vh);
  return { left: b.minLeft + (p.x / 100) * (b.maxLeft - b.minLeft), top: b.minTop + (p.y / 100) * (b.maxTop - b.minTop) };
}

function toPos(px: Px, vw: number, vh: number): Pos {
  const b = bounds(vw, vh);
  const pct = (v: number, lo: number, hi: number) => (hi > lo ? clamp(((v - lo) / (hi - lo)) * 100, 0, 100) : 0);
  return { x: pct(px.left, b.minLeft, b.maxLeft), y: pct(px.top, b.minTop, b.maxTop) };
}

/** Round button with the organisation's logo, draggable on the page; opens the assistant popup. */
export function FloatingHelper() {
  const { t, lang } = useI18n();
  const { pathname } = useLocation();
  const { pageTopic, chatTopics } = usePageHelp();
  const [hidden, setHidden] = useHelperHidden();
  const [pos, setPos] = useState<Pos>(readPos);
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; sx: number; sy: number; start: Px; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  // Positions are percentages, so a resize re-places the icon; only the viewport size needs tracking.
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Focus moves into the popup when it opens.
  useEffect(() => {
    if (open) popRef.current?.focus();
  }, [open]);

  if (hidden) return null;

  const px = toPx(pos, vp.w, vp.h);

  // Popup: beside the icon, above it when there is room, kept inside the viewport.
  const pw = Math.min(POP_W, vp.w * 0.9);
  const ph = Math.min(POP_H, vp.h * 0.8);
  const popLeft = clamp(px.left + SIZE - pw, MARGIN, vp.w - pw - MARGIN);
  const above = px.top - ph - GAP >= MARGIN;
  const popTop = above ? px.top - ph - GAP : clamp(px.top + SIZE + GAP, MARGIN, vp.h - ph - MARGIN);

  const close = (refocus = true) => {
    setOpen(false);
    setMenu(false);
    if (refocus) fabRef.current?.focus();
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    suppressClick.current = false;
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, start: px, moved: false };
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved) {
      // Under the threshold it is still a click.
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      d.moved = true;
      setDragging(true);
      fabRef.current?.setPointerCapture(e.pointerId);
    }
    setPos(toPos({ left: d.start.left + dx, top: d.start.top + dy }, vp.w, vp.h));
  };

  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId || !d.moved) return;
    const p = toPos({ left: d.start.left + (e.clientX - d.sx), top: d.start.top + (e.clientY - d.sy) }, vp.w, vp.h);
    suppressClick.current = true;
    setDragging(false);
    setPos(p);
    writePos(p);
  };

  const onClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setOpen((o) => !o);
  };

  // Arrow keys move the icon (Shift for larger steps).
  const onFabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 40 : 10;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    const p = toPos({ left: px.left + d[0], top: px.top + d[1] }, vp.w, vp.h);
    setPos(p);
    writePos(p);
  };

  const onPopKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    if (menu) setMenu(false);
    else close();
  };

  const label = t('Assistant Imago', 'Imago assistant');

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        className={`helper-fab ${dragging ? 'is-dragging' : ''}`}
        style={{ left: px.left, top: px.top }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
        onKeyDown={onFabKey}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`${label} (${t('glisser pour déplacer', 'drag to move')})`}
      >
        <BrandLogo size={26} />
      </button>

      {open && (
        <div
          ref={popRef}
          className="helper-pop"
          role="dialog"
          aria-label={label}
          tabIndex={-1}
          style={{ left: popLeft, top: popTop, width: pw, height: ph }}
          onKeyDown={onPopKey}
        >
          <div className="helper-pop-head">
            <BrandLogo size={22} />
            <strong className="helper-pop-title">{label}</strong>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => close()} aria-label={t('Réduire', 'Minimize')} title={t('Réduire', 'Minimize')}>
              <Minimize2 size={16} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => setMenu((m) => !m)}
              aria-haspopup="menu"
              aria-expanded={menu}
              aria-label={t('Plus d’options', 'More options')}
            >
              <EllipsisVertical size={16} />
            </button>
            {menu && (
              <div className="helper-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setHidden(true);
                    close(false);
                  }}
                >
                  <EyeOff size={15} /> {t('Masquer l’assistant', 'Hide the assistant')}
                </button>
              </div>
            )}
          </div>
          <div className="helper-pop-body">
            <AssistantChat scope="app" page={{ path: pathname, title: pageTopic?.title[lang] }} topics={chatTopics} storageKey="app" />
          </div>
        </div>
      )}
    </>
  );
}
