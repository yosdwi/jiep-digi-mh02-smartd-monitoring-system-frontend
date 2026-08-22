import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { navigation } from './navigation';
import { color as C, font, text, layout, zIndex, radius, space } from '../foundation/tokens';

// Application navigation: 232px, labelled, always readable.
//
// It was a 56px icon rail whose labels appeared on hover. Nine destinations in
// three named groups is a menu, and a menu you have to hover to read is a menu
// the product is apologising for. The rail survives as the *collapsed* state —
// a choice the operator makes and we remember — rather than the default.
//
// Light, not the dark slab it was. A dark navigation against a white workspace
// is the strongest visual statement in the app, and it was being spent on
// chrome rather than on the map or the data.

const COLLAPSE_KEY = 'v3.nav.collapsed';

export default function AppNav() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');

  const width = collapsed ? layout.navWidthCollapsed : layout.navWidth;

  const toggle = () => {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSE_KEY, prev ? '0' : '1');
      return !prev;
    });
  };

  return (
    <nav style={{
      width,
      flexShrink: 0,
      zIndex: zIndex.rail,
      background: C.g0,
      borderRight: `1px solid ${C.line}`,
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 140ms ease',
      overflow: 'hidden',
    }}>
      <div style={{
        height: layout.contextBarHeight, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: space[3],
        padding: `0 ${(layout.navWidthCollapsed - 28) / 2}px`,
        borderBottom: `1px solid ${C.line}`,
      }}>
        <div style={{
          width: 28, height: 28, flexShrink: 0, borderRadius: radius.md,
          background: C.sel, color: C.white,
          display: 'grid', placeItems: 'center',
          ...text.sm, fontWeight: 700, fontFamily: font.sans,
        }}>
          S
        </div>
        {!collapsed ? (
          <span style={{
            ...text.md, fontWeight: 600, color: C.ink,
            whiteSpace: 'nowrap', letterSpacing: '-0.01em',
          }}>
            SMARTD
          </span>
        ) : null}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: `${space[3]}px 0` }}>
        {navigation.map((group, groupIndex) => (
          <div key={group.key} style={{ marginBottom: space[2] }}>
            {/* Collapsed, a group is a hairline. A text placeholder here reads as
                truncated content rather than as a divider. */}
            {!collapsed ? (
              <div style={{
                ...text.label, color: C.g5,
                padding: `${space[3]}px ${space[4]}px ${space[1]}px`,
                whiteSpace: 'nowrap',
              }}>
                {group.label}
              </div>
            ) : groupIndex > 0 ? (
              <div style={{ height: 1, margin: `${space[2]}px ${space[3]}px`, background: C.line }} />
            ) : null}

            {group.items.map((item) => {
              const active = location.pathname.startsWith(item.path);
              return (
                <NavLink
                  key={item.key}
                  to={item.path}
                  className="v3-nav-item"
                  title={collapsed ? `${item.label} — ${item.hint}` : undefined}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: space[3],
                    height: 40,
                    margin: `1px ${space[2]}px`,
                    padding: `0 ${(layout.navWidthCollapsed - 24) / 2 - space[2]}px`,
                    borderRadius: radius.md,
                    color: active ? C.sel : C.g6,
                    background: active ? C.selBg : 'transparent',
                    textDecoration: 'none',
                    ...text.base,
                    fontWeight: active ? 600 : 400,
                    fontFamily: font.sans,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{
                    width: 24, textAlign: 'center', fontSize: 18,
                    flexShrink: 0, lineHeight: 1,
                  }}>
                    {item.glyph}
                  </span>
                  {!collapsed ? <span>{item.label}</span> : null}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={toggle}
        title={collapsed ? 'Tampilkan label navigasi' : 'Ciutkan navigasi'}
        style={{
          height: 40, flexShrink: 0, border: 'none', cursor: 'pointer',
          background: 'transparent', color: C.g5,
          borderTop: `1px solid ${C.line}`,
          ...text.sm, fontFamily: font.sans,
          textAlign: collapsed ? 'center' : 'left',
          padding: collapsed ? 0 : `0 ${space[4]}px`,
        }}
      >
        {collapsed ? '▸' : '◂ Ciutkan'}
      </button>
    </nav>
  );
}
