import React from 'react';
import { T } from './mirTokens';

// Diagram lintasan pre/on di KARTU crossing — skematik animatif (persis mockup #daTrace).
// Data GPS ASLI (evidence) digambar di PETA (deck trace di MIRPeta); kartu = skema, biar konsisten visual.
// Evidence: {pre, on} saja (post dihapus per ADR-7 / CONTRACT §Evidence 2026-06-12).
export default function MirTrace() {
  return (
    <div style={{ border: `1px solid ${T.g3}`, borderRadius: 4, marginBottom: 10, background: T.g0, padding: '5px 7px 3px', display: 'flex', flexDirection: 'column' }}>
      <svg viewBox="0 0 180 70" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: 74, display: 'block' }}>
        {/* garis dumping (dilintasi) */}
        <line x1="100" y1="6" x2="100" y2="64" stroke="#5b6675" strokeWidth="1.5" strokeDasharray="4 4" />
        {/* pre → ON */}
        <polyline points="18,20 60,33 100,44" fill="none" stroke="#8a96a6" strokeWidth="2" strokeDasharray="4 3" />
        <polyline points="100,44 160,58" fill="none" stroke={T.crit} strokeWidth="3" />
        <g fontFamily={T.mono} fontSize="8" fontWeight="700" fill={T.g6}>
          <text x="14" y="13">pre</text>
          <text x="88" y="12" fill={T.crit}>ON</text>
        </g>
        {/* titik crossing berdenyut */}
        <circle cx="100" cy="44" r="3.5" fill={T.crit} />
        <circle cx="100" cy="44" r="3.5" fill="none" stroke={T.crit} strokeWidth="1.2">
          <animate attributeName="r" values="3.5;10;3.5" dur="1.7s" repeatCount="indefinite" />
          <animate attributeName="opacity" values=".5;0;.5" dur="1.7s" repeatCount="indefinite" />
        </circle>
        {/* marker unit bergerak pre→on */}
        <g>
          <path d="M0,-5 L4,4 L-4,4 Z" fill={T.crit} stroke="#fff" strokeWidth=".8" />
          <animateMotion dur="3.0s" repeatCount="indefinite" rotate="auto" path="M18,20 L60,33 L100,44 L160,58" />
        </g>
      </svg>
      <span style={{ fontFamily: T.mono, fontSize: 9, color: T.g5, textAlign: 'center', marginTop: 1 }}>
        pre (mendekati) → ON (melintas garis) · sama dgn lintasan di peta
      </span>
    </div>
  );
}
