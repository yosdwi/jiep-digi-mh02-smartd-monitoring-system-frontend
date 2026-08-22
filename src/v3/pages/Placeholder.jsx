import { Link } from 'react-router-dom';
import { color as C, text, space, radius, font } from '../foundation/tokens';

// Honest placeholder for V3 surfaces that are planned but not built.
//
// It states what is missing, which phase covers it, and where the working V1/V2
// screen is — rather than rendering an empty shell that looks broken or, worse,
// a fake dashboard.

export default function Placeholder({ title, phase, summary, legacyPath, legacyLabel, points = [] }) {
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: C.g0, padding: space[6] }}>
      <div style={{
        maxWidth: 640, margin: '0 auto', background: C.white,
        border: `1px solid ${C.line}`, borderRadius: radius.md, padding: space[6],
      }}>
        <div style={{ ...text.label, color: C.g5, marginBottom: 6 }}>{phase}</div>
        <h1 style={{ ...text.lg, fontWeight: 700, color: C.ink, margin: `0 0 ${space[3]}px` }}>{title}</h1>
        <p style={{ ...text.md, color: C.g6, margin: `0 0 ${space[4]}px`, lineHeight: '21px' }}>{summary}</p>

        {points.length > 0 ? (
          <ul style={{ margin: `0 0 ${space[4]}px`, paddingLeft: 18, color: C.g6, ...text.base, lineHeight: '20px' }}>
            {points.map((p) => <li key={p} style={{ marginBottom: 4 }}>{p}</li>)}
          </ul>
        ) : null}

        {legacyPath ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: space[2],
            padding: space[3], background: C.g0, border: `1px solid ${C.line}`, borderRadius: radius.sm,
          }}>
            <span style={{ ...text.sm, color: C.g5 }}>Versi yang berjalan sekarang:</span>
            <Link
              to={legacyPath}
              style={{ ...text.base, color: C.sel, fontWeight: 600, fontFamily: font.sans }}
            >
              {legacyLabel} →
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
