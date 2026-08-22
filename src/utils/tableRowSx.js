// Skip rendering/painting <tr> rows scrolled off-screen. Native CSS, no virtualizer lib.
// containIntrinsicSize is a height guess used before a row is ever measured — keeps scrollbar/scroll-jump sane.
export const virtualRowSx = (heightPx = 36) => ({
  contentVisibility: 'auto',
  containIntrinsicSize: `auto ${heightPx}px`,
});
