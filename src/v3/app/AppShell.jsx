import { Outlet, useLocation } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import AppNav from './AppNav';
import { findNavItem } from './navigation';
import { mantineTheme } from '../foundation/mantineTheme';
import { color as C, font, text } from '../foundation/tokens';
// Mantine's stylesheet is UNLAYERED, and unlayered CSS beats every `@layer`
// rule regardless of specificity or import order. theme.css puts its own rules
// in `@layer base`, so Mantine wins any overlap between them no matter what
// order these imports appear in. That is the intended outcome — Mantine styles
// Mantine's components, theme.css styles everything else — but it means a
// conflict cannot be resolved by moving these lines around.
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
// Scoped to `.v3` below — see the header of theme.css for why preflight is off.
import '../foundation/theme.css';

// Rail + content. The context bar is NOT here: it belongs to the historical
// pages that share a query context, and mounting it globally would put a unit
// picker on top of the GIS pages where it means nothing.
//
// MantineProvider lives here rather than at the app root deliberately. V1, V2
// and MIR (~24k lines of MUI) share this bundle, and Mantine's design tokens
// are emitted as CSS custom properties on whatever selector it is told to use.
// Pointing that at `.v3` keeps them off `:root`, so a Mantine variable can never
// resolve inside a legacy page — the same containment strategy that made
// Tailwind safe to add here (theme.css, preflight excluded).

export default function AppShell() {
  const location = useLocation();
  const item = findNavItem(location.pathname);

  return (
    <MantineProvider
      theme={mantineTheme}
      // `:root`, not `.v3`.
      //
      // Scoping the variables to `.v3` looked like the safe choice and was the
      // wrong one: every popover, dropdown and modal renders through a portal
      // into document.body, which is OUTSIDE that subtree. The `--mantine-*`
      // custom properties did not resolve there, so portalled content fell back
      // to unset values — a checked checkbox drew white on white.
      //
      // Putting them on :root is safe because they are namespaced. Legacy MUI
      // reads none of them, and the containment that actually matters — global
      // element resets and helper classes — is handled by the two flags below,
      // not by where the variables live.
      cssVariablesSelector=":root"
      // The legacy app has no colour-scheme handling and this product is
      // light-only by decision (plan §18). Forcing it stops Mantine from
      // reacting to an OS preference the rest of the bundle ignores.
      forceColorScheme="light"
      withCssVariables
      // Mantine's global helper classes (responsive visibility utilities) and
      // its unprefixed static classes are both off: nothing here uses them, and
      // they are the parts of the package that put unscoped selectors into a
      // bundle shared with ~24k lines of legacy MUI. What remains is Mantine's
      // component CSS, which is prefixed and only matches elements Mantine
      // renders — none of which exist outside this subtree.
      withGlobalClasses={false}
      withStaticClasses={false}
    >
      <div className="v3" style={{
        position: 'fixed', inset: 0, display: 'flex',
        background: C.g1, color: C.ink,
        font: `400 ${text.base.fontSize}px/${text.base.lineHeight} ${font.sans}`,
        WebkitFontSmoothing: 'antialiased',
      }}>
        <AppNav />
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Outlet context={{ navItem: item }} />
        </main>
      </div>
    </MantineProvider>
  );
}
