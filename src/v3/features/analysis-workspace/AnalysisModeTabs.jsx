import { color as C, font, radius, space, text } from '../../foundation/tokens';

export const ANALYSIS_MODES = [
  { key: 'cycle-time', label: 'Cycle Time', available: true },
  { key: 'speed-analysis', label: 'Speed Analysis', available: false },
  { key: 'gis-workspace', label: 'GIS Workspace', available: false },
  { key: 'duration-in-pit', label: 'Duration In Pit', available: false },
  { key: 'data-log-record', label: 'Data Log Record', available: false },
];

export default function AnalysisModeTabs({ activeMode, onModeChange }) {
  return (
    <nav
      aria-label="Mode analisis"
      style={{
        minHeight: 44,
        display: 'flex',
        alignItems: 'stretch',
        gap: space[1],
        padding: `0 ${space[3]}px`,
        borderBottom: `1px solid ${C.line}`,
        background: C.white,
        overflowX: 'auto',
        overflowY: 'hidden',
        flexShrink: 0,
      }}
    >
      {ANALYSIS_MODES.map((mode) => {
        const active = activeMode === mode.key;
        return (
          <button
            key={mode.key}
            type="button"
            disabled={!mode.available}
            aria-current={active ? 'page' : undefined}
            title={mode.available ? mode.label : `${mode.label} · tahap berikutnya`}
            onClick={() => mode.available && onModeChange(mode.key)}
            style={{
              position: 'relative',
              minWidth: 'max-content',
              padding: `0 ${space[3]}px`,
              border: 0,
              borderRadius: radius.sm,
              background: 'transparent',
              color: active ? C.sel : mode.available ? C.g6 : C.g4,
              cursor: mode.available ? 'pointer' : 'not-allowed',
              fontFamily: font.sans,
              ...text.sm,
              fontWeight: active ? 750 : 600,
            }}
          >
            {mode.label}
            {active ? (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: space[2],
                  right: space[2],
                  bottom: 0,
                  height: 3,
                  borderRadius: '3px 3px 0 0',
                  background: C.sel,
                }}
              />
            ) : null}
          </button>
        );
      })}

      <span
        style={{
          marginLeft: 'auto',
          paddingLeft: space[4],
          display: 'flex',
          alignItems: 'center',
          color: C.g5,
          ...text.xs,
          whiteSpace: 'nowrap',
        }}
      >
        Shared map · filter · playback
      </span>
    </nav>
  );
}
