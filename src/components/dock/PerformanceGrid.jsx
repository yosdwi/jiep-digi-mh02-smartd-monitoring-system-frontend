import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import { themeQuartz } from "ag-grid-community";
import { useWorkspace } from "../../state/WorkspaceContext";
import { fmt, fmtInt } from "../../utils/workspace";

const theme = themeQuartz.withParams({
  spacing: 5,
  rowVerticalPaddingScale: 0.8,
  headerVerticalPaddingScale: 0.8,
  accentColor: "#287c94",
  backgroundColor: "#ffffff",
  foregroundColor: "#172033",
  headerBackgroundColor: "#f7f9fb",
  headerTextColor: "#475467",
  borderColor: "#dfe3e8",
  rowHoverColor: "#f6fafb",
  selectedRowBackgroundColor: "#edf7f9",
  fontSize: 12,
});

function cycleRows(performance) {
  return performance.map((row) => ({ ...row, label: row.unitNo }));
}

function speedRows(state) {
  const segments = state.speed.draft?.segments ?? state.speed.active?.segments ?? [];
  const query = state.gridSearch.trim().toLowerCase();
  let filtered = query ? segments.filter((segment) => `${segment.id} ${segment.routeLabel} ${segment.roadName} ${segment.status}`.toLowerCase().includes(query)) : segments;
  if (state.speed.groupBy === "route") filtered = [...filtered].sort((a, b) => a.routeId.localeCompare(b.routeId) || a.id.localeCompare(b.id));
  if (state.speed.groupBy === "road") filtered = [...filtered].sort((a, b) => (a.roadName || "Belum dinamai").localeCompare(b.roadName || "Belum dinamai") || a.id.localeCompare(b.id));
  if (state.speed.groupBy === "status") filtered = [...filtered].sort((a, b) => a.status.localeCompare(b.status) || a.id.localeCompare(b.id));
  return filtered;
}

export default function PerformanceGrid() {
  const { state, dispatch, performance } = useWorkspace();
  const speed = state.mode === "speed";
  const rowData = useMemo(() => speed ? speedRows(state) : cycleRows(performance), [speed, state, performance]);
  const selected = new Set(speed ? state.speed.selectedSegments : state.selectedRows);
  const columnDefs = useMemo(() => speed ? [
    { field: "id", headerName: "Segment", minWidth: 140, flex: 1.2 },
    { field: "routeLabel", headerName: "Generated Route", minWidth: 120 },
    { field: "roadName", headerName: "Road Name", minWidth: 130, valueFormatter: ({ value }) => value || "—" },
    { field: "sta", headerName: "STA", width: 92 },
    { field: "status", headerName: "Review", width: 110 },
    { field: "plan", headerName: "Speed Plan", width: 105, valueFormatter: ({ value }) => `${fmt(value, 0)} km/h` },
    { field: "suggested", headerName: "Suggested", width: 100, valueFormatter: ({ value }) => `${fmt(value, 0)} km/h` },
    { field: "avgActual", headerName: "Avg Actual", width: 105, valueFormatter: ({ value }) => `${fmt(value, 1)} km/h` },
    { field: "lengthM", headerName: "Length", width: 90, valueFormatter: ({ value }) => `${fmtInt(value)} m` },
    { field: "unitNos", headerName: "Unit", width: 80, valueFormatter: ({ value }) => value?.length ?? 0 },
  ] : [
    { field: "loader", headerName: "Loader", minWidth: 110 },
    { field: "unitNo", headerName: "Unit", minWidth: 110, flex: 1 },
    { field: "ritase", headerName: "Ritase", width: 90, valueFormatter: ({ value }) => fmtInt(value) },
    { field: "cycle", headerName: "Avg Cycle Time", width: 125, valueFormatter: ({ value }) => `${fmt(value, 1)} min` },
    { field: "loadedDistance", headerName: "Avg Jarak Muatan", width: 135, valueFormatter: ({ value }) => `${fmt(value, 2)} km` },
    { field: "emptyDistance", headerName: "Avg Jarak Kosongan", width: 145, valueFormatter: ({ value }) => `${fmt(value, 2)} km` },
    { field: "speed", headerName: "Avg Actual Speed", width: 130, valueFormatter: ({ value }) => `${fmt(value, 1)} km/h` },
  ], [speed]);

  const onSelectionChanged = (event) => {
    const ids = event.api.getSelectedRows().map((row) => speed ? row.id : row.unitNo);
    if (speed) dispatch({ type: "PATCH_SPEED", patch: { selectedSegments: ids } });
    else dispatch({ type: "SET_SELECTED_ROWS", value: ids });
  };

  return (
    <div id="performanceGrid" style={{ height: "100%", minHeight: 190 }}>
      <AgGridReact
        theme={theme}
        rowData={rowData}
        columnDefs={columnDefs}
        getRowId={({ data }) => speed ? data.id : data.unitNo}
        defaultColDef={{ sortable: true, resizable: true, suppressHeaderMenuButton: true }}
        rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: true }}
        selectionColumnDef={{ width: 44, minWidth: 44, maxWidth: 44, pinned: "left", resizable: false, sortable: false }}
        onSelectionChanged={onSelectionChanged}
        onGridReady={(event) => event.api.forEachNode((node) => node.setSelected(selected.has(speed ? node.data.id : node.data.unitNo), false, "sync"))}
        onRowClicked={(event) => speed && dispatch({ type: "TOGGLE_SPEED_SEGMENT", id: event.data.id, multi: event.event?.ctrlKey || event.event?.metaKey })}
      />
    </div>
  );
}
