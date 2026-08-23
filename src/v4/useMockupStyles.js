import { useEffect } from 'react';
import mockupCss from './analysisWorkspaceV4.mockup.css?raw';

// The V4 mockup ships ~1900 lines of plain CSS (ported near-verbatim from the
// design file, every selector prefixed with `.v4mock` by a build-time script —
// see scope_css.py in the design handoff) including bare-tag rules (table, th,
// td, body...). Importing it as a normal Vite CSS module would apply globally
// and fight V3's own styling for the lifetime of the tab. Inject/remove it
// with the component instead so it only affects the DOM while V4 is mounted.
let refCount = 0;
let styleEl = null;

export default function useMockupStyles() {
  useEffect(() => {
    if (refCount === 0) {
      styleEl = document.createElement('style');
      styleEl.id = 'v4mock-styles';
      styleEl.textContent = mockupCss;
      document.head.appendChild(styleEl);
    }
    refCount += 1;
    return () => {
      refCount -= 1;
      if (refCount === 0 && styleEl) {
        styleEl.remove();
        styleEl = null;
      }
    };
  }, []);
}
