import { WORDMARK_D, WORDMARK_H, WORDMARK_W } from './logoPaths';

/**
 * Bhub logo: three "storage-bay" hexagons meeting at one hub point.
 * Geometry is hub-relative (0,0 = the hub) so the hexagons can scale out of it when animated.
 * Same shapes as /public/logo.svg and /public/icon.svg.
 */
const HEX = {
  teal: '-60.5,-77 -6.8,-46 -6.8,16 -60.5,47 -114.2,16 -114.2,-46',
  coral: '60.5,-77 114.2,-46 114.2,16 60.5,47 6.8,16 6.8,-46',
  yellow: '0,28 53.7,59 53.7,121 0,152 -53.7,121 -53.7,59',
};

export function LogoMark({ size = 40, animate = false, className = '' }: { size?: number; animate?: boolean; className?: string }) {
  return (
    <svg className={`logo-mark${animate ? ' animate' : ''} ${className}`.trim()} viewBox="-122 -84.5 244 244" width={size} height={size} aria-hidden focusable="false">
      <g className="hx hx-1"><polygon points={HEX.teal} fill="#0FB5AE" /></g>
      <g className="hx hx-2"><polygon points={HEX.coral} fill="#FF6B5B" /></g>
      <g className="hx hx-3"><polygon points={HEX.yellow} fill="#FFC93C" /></g>
      <g className="hub">
        <circle r="15" fill="#1D2B3A" />
        <circle r="5.5" fill="#F7F1E5" />
      </g>
    </svg>
  );
}

/** The mark on its cream tile — the app icon, used in the sidebar and on the sign-in card. */
export function LogoTile({ size = 44, animate = false }: { size?: number; animate?: boolean }) {
  return (
    <div className="brand-mark" style={{ width: size, height: size, borderRadius: Math.round(size * 0.32) }}>
      <LogoMark size={Math.round(size * 0.74)} animate={animate} />
    </div>
  );
}

/** "bhub" in outlines (Nunito 800) — no font download, inherits `color`. */
export function Wordmark({ height = 22, className = '' }: { height?: number; className?: string }) {
  return (
    <span className={`wordmark ${className}`.trim()} role="img" aria-label="Bhub" style={{ height }}>
      <svg viewBox={`0 0 ${WORDMARK_W} ${WORDMARK_H}`} height={height} width={(height * WORDMARK_W) / WORDMARK_H} aria-hidden focusable="false">
        <path d={WORDMARK_D} fill="currentColor" />
      </svg>
    </span>
  );
}
