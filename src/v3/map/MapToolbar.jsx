import { useState } from 'react';
import { color as C, shadow, radius, space, text, font } from '../foundation/tokens';

const SIZE = 38;

export function ToolButton({ glyph, label, shortcut, active, danger, onClick, disabled }) {
  const [hover, setHover] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width: SIZE, height: SIZE,
          display: 'grid', placeItems: 'center',
          border: 'none',
          borderLeft: `2px solid ${active ? C.sel : 'transparent'}`,
          background: active ? C.selBg : hover && !disabled ? C.g0 : C.white,
          color: disabled ? C.g3 : danger ? C.crit : active ? C.sel : C.g6,
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 17, lineHeight: 1,
          transition: 'background 100ms',
        }}
      >
        <span style={{ display: 'grid', placeItems: 'center', width: 22, height: 22 }}>
          {glyph}
        </span>
      </button>

      {hover && !disabled ? (
        <div style={{
          position: 'absolute', right: SIZE + 6, top: '50%', transform: 'translateY(-50%)',
          background: C.ink, color: C.white, padding: '4px 8px', borderRadius: radius.sm,
          whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 30,
          ...text.sm, fontFamily: font.sans, boxShadow: shadow.float,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {label}
          {shortcut ? (
            <kbd style={{
              background: 'rgba(255,255,255,0.18)', borderRadius: 2, padding: '0 4px',
              ...text.xs, fontFamily: font.mono,
            }}>
              {shortcut}
            </kbd>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ToolGroup({ children, label }) {
  return (
    <>
      {label ? (
        <div style={{
          ...text.xs, color: C.g4, textAlign: 'center', padding: '3px 0 1px',
          background: C.g0, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`,
          fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700,
        }}>
          {label}
        </div>
      ) : <div style={{ height: 1, background: C.line }} />}
      {children}
    </>
  );
}

export default function MapToolbar({
  tool,
  onToolChange,
  onResetView,
  onZoomIn,
  onZoomOut,
  groups = [],
}) {
  return (
    <div style={{
      position: 'absolute', top: space[2], right: space[2],
      display: 'flex', flexDirection: 'column',
      background: C.white, border: `1px solid ${C.lineStrong}`,
      borderRadius: radius.md, boxShadow: shadow.float, overflow: 'hidden',
      zIndex: 12,
    }}>
      <ToolButton glyph={<IconPan />} label="Geser peta" shortcut="V" active={tool === 'pan'} onClick={() => onToolChange('pan')} />
      <ToolButton glyph={<IconMeasure />} label="Ukur jarak" shortcut="D" active={tool === 'measure'} onClick={() => onToolChange('measure')} />

      <ToolGroup>
        <ToolButton glyph={<IconZoomIn />} label="Perbesar" onClick={onZoomIn} disabled={!onZoomIn} />
        <ToolButton glyph={<IconZoomOut />} label="Perkecil" onClick={onZoomOut} disabled={!onZoomOut} />
        <ToolButton glyph={<IconFit />} label="Muat semua data" shortcut="F" onClick={onResetView} />
      </ToolGroup>

      {groups.map((group) => (
        <ToolGroup key={group.key} label={group.label}>
          {group.tools.map((item) => (
            <ToolButton
              key={item.key}
              glyph={item.glyph}
              label={item.label}
              shortcut={item.shortcut}
              danger={item.danger}
              disabled={item.disabled}
              active={tool === item.key}
              onClick={() => (item.onClick ? item.onClick() : onToolChange(item.key))}
            />
          ))}
        </ToolGroup>
      ))}
    </div>
  );
}

function SvgIcon({ children }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function IconPan() {
  return <SvgIcon><path {...stroke} d="M8 3.5v7.2m3-5.4v5.4m3-3.7v4.7c0 3.1-1.9 5-4.8 5H8.1c-1.4 0-2.5-.5-3.4-1.5L3 13.3c-.5-.6-.4-1.4.2-1.8.5-.4 1.2-.3 1.7.2l1 1V4.2c0-.7.5-1.2 1.1-1.2s1 .5 1 1.2m3 1.1c0-.7-.5-1.2-1.1-1.2-.6 0-1 .5-1 1.2m6 1.7c0-.7-.5-1.2-1.1-1.2-.6 0-1 .5-1 1.2" /></SvgIcon>;
}

function IconMeasure() {
  return <SvgIcon><path {...stroke} d="M4 15.5 15.5 4" /><path {...stroke} d="M5.8 13.7 7 14.9m1.2-3.4 1.2 1.2m1.2-3.4 1.2 1.2m1.2-3.4 1.2 1.2" /></SvgIcon>;
}

function IconZoomIn() {
  return <SvgIcon><path {...stroke} d="M8.7 14.1a5.4 5.4 0 1 1 0-10.8 5.4 5.4 0 0 1 0 10.8Zm4.1-1.3 3.9 3.9M8.7 6.3v4.8M6.3 8.7h4.8" /></SvgIcon>;
}

function IconZoomOut() {
  return <SvgIcon><path {...stroke} d="M8.7 14.1a5.4 5.4 0 1 1 0-10.8 5.4 5.4 0 0 1 0 10.8Zm4.1-1.3 3.9 3.9M6.3 8.7h4.8" /></SvgIcon>;
}

function IconFit() {
  return <SvgIcon><path {...stroke} d="M3.5 7V3.5H7m6 0h3.5V7m0 6v3.5H13m-6 0H3.5V13" /><path {...stroke} d="M7 7h6v6H7z" /></SvgIcon>;
}

export function MapHint({ children, tone = 'info' }) {
  const background = tone === 'warn' ? C.warn : C.ink;
  return (
    <div style={{
      position: 'absolute', top: space[2], left: '50%', transform: 'translateX(-50%)',
      background, color: C.white, padding: '6px 12px',
      borderRadius: radius.sm, ...text.base, boxShadow: shadow.float, zIndex: 12,
      pointerEvents: 'none', maxWidth: '70%', textAlign: 'center',
    }}>
      {children}
    </div>
  );
}

/**
 * Zoom + coordinate readout.
 *
 * Renders inline by default, so pages with a temporal dock can put it in the
 * dock header instead of floating it over the map: it is reference information
 * the operator glances at, not a map control, and every floating chip covers a
 * piece of the site.
 *
 * `floating` restores the old overlay for pages that have no dock to host it —
 * Area Operasi is all map, with nowhere else for this to go.
 */
export function MapStatusBar({ zoom, coordinate, orthoLoading = false, floating = false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: space[3],
      ...text.xs, color: C.g5, fontFamily: font.mono,
      whiteSpace: 'nowrap',
      ...(floating ? {
        position: 'absolute', bottom: space[2], left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(255,255,255,0.94)', border: `1px solid ${C.line}`,
        borderRadius: radius.sm, padding: '3px 10px', zIndex: 11,
      } : null),
    }}>
      <span className="tnum">z{Number(zoom || 0).toFixed(1)}</span>
      {coordinate ? (
        <span className="tnum">{coordinate[1].toFixed(5)}, {coordinate[0].toFixed(5)}</span>
      ) : null}
      {/* Imagery streams in tile by tile. Saying so here — quietly, in the strip
          the user already reads for map state — is what turns a half-painted
          site from "broken" into "still arriving". */}
      {orthoLoading ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: C.g5, fontFamily: 'inherit' }}>
          <span style={{
            width: 5, height: 5, borderRadius: 999, background: C.sel,
            animation: 'v3-pulse 1s ease-in-out infinite',
          }} />
          memuat ortho
        </span>
      ) : null}
    </div>
  );
}
