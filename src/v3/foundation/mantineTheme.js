import { createTheme, rem } from '@mantine/core';
import { color as C, font, layout, radius, text } from './tokens';

// Mantine configured from the tokens that already exist, not from its defaults.
//
// The palette in tokens.js was promoted from mirTokens.js — a validated, light,
// colourblind-safe set carrying the house rule "bentuk dulu, warna penguat".
// Adopting Mantine is a change of primitive layer, not of design language, so
// the theme below is a mapping exercise: Mantine supplies behaviour, focus
// management and accessibility; the values stay ours.
//
// Two Mantine defaults are deliberately overridden throughout:
//
//  - Shadows. Mantine leans on elevation; this product separates surfaces with
//    borders and reserves shadow for things genuinely floating over the map.
//  - Radii. Mantine's default scale is rounder than the 4/6/10 here, which is
//    what keeps an operational tool from reading as a consumer app.

/**
 * Mantine expects ten shades per colour. Only a few of ours are referenced by
 * name, so the ramp is built around the token rather than invented: index 6 is
 * the canonical value Mantine uses for `filled`, and 0 is the tint used for
 * light variants and selected rows.
 */
const ramp = (tint, base, dark) => [
  tint, tint, base, base, base, base, base, dark, dark, dark,
];

export const mantineTheme = createTheme({
  fontFamily: font.sans,
  fontFamilyMonospace: font.mono,

  // Mantine's own scale is a step smaller than ours at every tier. Restating it
  // here is what keeps a Mantine `size="sm"` and a token `text.sm` from meaning
  // two different things in the same panel.
  fontSizes: {
    xs: rem(text.micro.fontSize),
    sm: rem(text.xs.fontSize),
    md: rem(text.base.fontSize),
    lg: rem(text.md.fontSize),
    xl: rem(text.lg.fontSize),
  },
  lineHeights: {
    xs: text.micro.lineHeight,
    sm: text.xs.lineHeight,
    md: text.base.lineHeight,
    lg: text.md.lineHeight,
    xl: text.lg.lineHeight,
  },
  headings: {
    fontFamily: font.sans,
    fontWeight: '600',
    sizes: {
      h1: { fontSize: rem(text.xl.fontSize), lineHeight: text.xl.lineHeight },
      h2: { fontSize: rem(text.lg.fontSize), lineHeight: text.lg.lineHeight },
      h3: { fontSize: rem(text.md.fontSize), lineHeight: text.md.lineHeight },
    },
  },

  radius: {
    xs: rem(radius.sm),
    sm: rem(radius.sm),
    md: rem(radius.md),
    lg: rem(radius.lg),
    xl: rem(radius.lg),
  },
  defaultRadius: 'md',

  shadows: {
    xs: '0 1px 2px rgba(36,50,64,0.08), 0 0 0 1px rgba(36,50,64,0.06)',
    sm: '0 1px 2px rgba(36,50,64,0.08), 0 0 0 1px rgba(36,50,64,0.06)',
    md: '0 2px 8px rgba(36,50,64,0.14), 0 0 0 1px rgba(36,50,64,0.08)',
    lg: '0 2px 8px rgba(36,50,64,0.14), 0 0 0 1px rgba(36,50,64,0.08)',
    xl: '0 2px 8px rgba(36,50,64,0.14), 0 0 0 1px rgba(36,50,64,0.08)',
  },

  white: C.white,
  black: C.ink,
  primaryColor: 'brand',
  primaryShade: 6,

  colors: {
    brand: ramp(C.selBg, C.sel, '#186176'),
    ok: ramp('#e8f5ee', C.ok, '#237a46'),
    warn: ramp('#fdf0e3', C.warn, '#a35f1f'),
    crit: ramp('#fbeae9', C.crit, '#a83831'),
    // Mantine reaches for `gray` constantly — borders, dimmed text, subtle
    // backgrounds. Pointing it at the token greys is what stops Mantine's own
    // neutral from appearing beside ours and reading as two products.
    gray: [C.g0, C.g1, C.g2, C.g3, C.g4, C.g5, C.g6, C.ink, C.ink, C.ink],
  },

  components: {
    Button: {
      defaultProps: { size: 'sm' },
      styles: { root: { height: layout.controlHeight, fontWeight: 500 } },
    },
    ActionIcon: {
      defaultProps: { variant: 'subtle', color: 'gray' },
    },
    Paper: {
      defaultProps: { withBorder: true, shadow: 'xs', radius: 'md' },
    },
    Popover: {
      defaultProps: { shadow: 'md', withinPortal: true, radius: 'md' },
    },
    Modal: {
      defaultProps: { centered: true, radius: 'md', overlayProps: { backgroundOpacity: 0.35, blur: 0 } },
    },
    Badge: {
      // Mantine badges are uppercase and pill-shaped by default. Both are the
      // "excessive pills" the brief rules out.
      defaultProps: { radius: 'sm', variant: 'light' },
      styles: { root: { textTransform: 'none', fontWeight: 600 } },
    },
    Tooltip: {
      defaultProps: { withArrow: true, openDelay: 300 },
    },
  },
});
