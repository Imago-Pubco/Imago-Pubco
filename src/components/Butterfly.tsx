import type { CSSProperties } from 'react';
import './butterfly.css';

interface Props {
  size?: number;
  /**
   * Omit for the Pubco brand colours (slate / blue / teal facets).
   * Pass a colour (e.g. `currentColor`, `#fff`) for a single-colour version,
   * where facets are told apart by opacity.
   */
  color?: string;
  /** Gentle continuous flapping. */
  flutter?: boolean;
  className?: string;
  style?: CSSProperties;
}

/* Pubco brand palette, slightly brightened so it reads on dark backgrounds too. */
export const PUBCO_SLATE = '#71849e';
export const PUBCO_BLUE = '#1f74c2';
export const PUBCO_TEAL = '#16809f';

/*
 * Geometric (origami) Pubco butterfly, drawn on a 400×230 grid centred on x = 200.
 * Right wing facets; the left wing is the mirror image with upper colours swapped.
 */
const UPPER = '212,64 362,8 296,122 212,148';
const OVERLAP = '212,104 275,128 212,148';
const LOWER = '212,104 302,139 244,222';
const LOWER_INNER = '222,150 275,128 240,196';

export function Butterfly({ size = 32, color, flutter, className = '', style }: Props) {
  const mono = !!color;
  const f = (brand: string, opacity: number) => (mono ? { fill: color, fillOpacity: opacity } : { fill: brand });
  return (
    <svg
      viewBox="0 0 400 230"
      width={size}
      height={size}
      className={`butterfly ${flutter ? 'flutter' : ''} ${className}`}
      style={style}
      aria-hidden="true"
    >
      <g className="wing wing-l" transform="translate(400 0) scale(-1 1)">
        <g className="wing-inner">
          <polygon points={UPPER} {...f(PUBCO_SLATE, 0.62)} />
          <polygon points={LOWER} {...f(PUBCO_BLUE, 1)} />
          <polygon points={LOWER_INNER} {...f(PUBCO_SLATE, 0.62)} />
          <polygon points={OVERLAP} {...f(PUBCO_TEAL, 0.9)} />
        </g>
      </g>
      <g className="wing wing-r">
        <g className="wing-inner">
          <polygon points={UPPER} {...f(PUBCO_BLUE, 1)} />
          <polygon points={LOWER} {...f(PUBCO_SLATE, 0.62)} />
          <polygon points={LOWER_INNER} {...f(PUBCO_BLUE, 1)} />
          <polygon points={OVERLAP} {...f(PUBCO_TEAL, 0.8)} />
        </g>
      </g>
    </svg>
  );
}

/** Sidebar wordmark: Pubco butterfly + PUBCO, with the app name underneath. */
export function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <div className="wordmark">
      <Butterfly size={compact ? 32 : 38} flutter />
      {!compact && (
        <div className="wordmark-text">
          <strong>PUBCO</strong>
          <span>Imago · Hub 2.0</span>
        </div>
      )}
    </div>
  );
}
