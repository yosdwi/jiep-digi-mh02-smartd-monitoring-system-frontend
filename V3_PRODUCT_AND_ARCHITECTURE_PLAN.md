# V3 — Product & Architecture Plan

SMARTD MH02 — mining fleet operations GIS.

Companion documents: `CYCLETIME_PLAYBACK_PERFORMANCE_RESEARCH.md` (what was tried
inside the V2 animation loop), `CYCLETIME_STACK_AUDIT_V3.md` (why the stack is not
the problem and which two mechanisms are).

This document is the deliverable required before large V3 code changes. Every
claim below is anchored to a file and line in the current source; where the
research brief and the source disagreed, the source won and the difference is
noted.

UI language stays Indonesian. V1 and V2 stay on their existing routes untouched.

---

## 1. Current-product audit

### 1.1 What actually exists

| Route | Page | State |
|---|---|---|
| `/live-tracking/live-unit` | `LiveUnitPeta.jsx` (274 ln) | Real. MQTT live feed, working product. |
| `/playback/cycle-time` | `CycleTimePeta.jsx` (257 ln) | Real. V1 reference, maplibre + deck.gl. |
| `/playback/cycle-time-v2` | `CycleTimePetaV2.jsx` (249 ln) | Real. deck.gl-only rewrite. |
| `/playback/underspeed` | `UnderspeedPeta.jsx` (190 ln) | **Mock.** See 1.3. |
| `/playback/leadtime` | `DurasiPitStopPeta.jsx` (290 ln) | Real logic, main-thread. |
| `/playback/datalog-record` | `DatalogRecord.jsx` (1623 ln) | Real, largest page in the app. |
| `/playback/rtk-quality` | `RTKQuality.jsx` (378 ln) | Real. Out of V3 scope. |
| `/mir/*` | 6 pages, ~4000 ln | Separate product (MIR service). Out of V3 scope. |

### 1.2 The data path already ends in columnar form — and throws it away

`workers/playbackChunkDecoder.worker.js` decodes Arrow IPC into typed arrays
(`Float64Array` for epoch/lat/lon, `Float32Array` for speed/plm_status/hm/fuel/
tonnage, `Uint8Array` for the context flag) at lines 24–49 — and then, at lines
62–81, loops over those same arrays to build one JavaScript object per row,
including `new Date(epoch).toISOString()` per row, and structured-clones the
object array back to the main thread. The typed arrays are discarded.

This is the single most valuable finding in the audit. The columnar
representation V3 needs already exists, one line before it is destroyed.

Backend Arrow schema (`Services/PlaybackV2ArrowWriter.cs:16-28`):

```
deviceid          string     unitno            string
timestamp_epoch_ms int64     latitude          double
longitude         double     speed             float
vehiclespeed      float      plm_status        float
hm                float      fuel_level_tm     float
act_tonnage       float      context           bool
```

Fixed-width, nullable-typed, one row per second per device. This is already the
right wire format. No backend contract change is required for the V3 dot trace.

### 1.3 Underspeed is not connected to anything

`pages/UnderspeedPeta.jsx:54-76` fetches `/Monitoring/dummy/unit_tracks.json` and
assigns every point a speed with `Math.floor(Math.random() * 50)`. The speed
bands at lines 12–18 are hardcoded in the page file. `handleApplyFilter`
(line 97) ignores its `filters` argument and shows the same dummy data.

The page is a visual mock. It has never rendered a real underspeed observation.
This is not a redesign target — it is a feature that must be built, and V3 is
where it gets built, on the shared historical engine.

### 1.4 Durasi In Pit is real, and its business rules are load-bearing

`pages/DurasiPitStopPeta.jsx:88-189`. Pit polygons come from a static KML
(`/Monitoring/kml/durasipitstop/pitstops.kml`), parsed with `DOMParser` on mount.
Dwell detection is a per-unit sequential scan calling
`turf.booleanPointInPolygon` for every point against every polygon, then:

- `MIN_DURATION_SECONDS = 30` — events shorter than this are discarded as GPS noise.
- `MERGE_GAP_SECONDS = 60` — an exit and re-entry into the *same* polygon within
  60 s is merged into one event.
- A unit moving directly from polygon A to polygon B closes the A event at the
  first B point (line 135).
- An event still open at the last sample is closed at that sample's timestamp
  (line 145).

These four rules are the business definition of "durasi in pit". V3 preserves
them byte-for-byte and moves only *where they execute*, not *what they compute*.

Cost today: O(points × polygons) `booleanPointInPolygon` synchronously inside a
`useEffect`, on the main thread, every time `trackingData` changes.

### 1.5 The historical engine is already two-tier — it just isn't presented that way

`stores/cycleTimeStore.js`:

- `fetchTrackingData` (line 403) creates a server-side query, polls status, and
  pulls a **preview**: downsampled, all selected devices, with `sampling` counts
  per class and an `availableHours` manifest (line 529).
- `ensureSelectedHaulerChunks` (line 555) then streams **full-resolution hourly
  chunks for the selected hauler only**, keeping `MAX_CHUNK_CACHE = 6` hours.

So the backend and store already implement "coarse overview for everyone,
full detail for one". The UI throws that distinction away by flattening both into
a single `trackingData` POJO array that every page consumes.

V3's "exploration vs focused playback" split is not a new backend capability. It
is the existing capability, surfaced.

### 1.6 Filters

`components/modals/FilterModal.jsx` (972 ln) is shared by Cycle Time, Underspeed
and Durasi In Pit. It holds genuinely valuable logic that must survive:

- Loader-first or hauler-first selection modes (line 70).
- Date shortcuts: last 1h, last 12h, today, yesterday (lines 133–163).
- Per-hauler S3 data availability, shown as "tersedia / tanpa data" counts
  (lines 714–743) — operators use this to avoid querying empty ranges.
- `sourceMode` miforce / timesheet / both, with a comparison modal (line 90).
- WITA offset handling (`withWitaOffset`, store line 51) — appends `+08:00` to
  naive datetime strings.

### 1.7 Polygon editing already exists

`pages/MIRGeofence.jsx` (1363 ln) uses `EditableGeoJsonLayer` with
`DrawPolygonMode`, `ModifyMode`, `TranslateMode`, `ViewMode` from
`@deck.gl-community/editable-layers`, plus KML import/export
(`utils/kml.js`). V3 GIS reuses this machinery rather than inventing an editor.

### 1.8 There is already a house design language

`components/mir/operasi/mirTokens.js` defines a light, colorblind-safe,
shape-first token set (`T.ink #243240`, `T.line #dde3ea`, `T.sel #1f7a96`,
semantic `ok/warn/crit`), and encodes the principle "BENTUK dulu, warna
penguat" — shape first, colour as reinforcement. It references a
`_mockups/DESIGN.md` that is not in the repository.

V3 does not invent a new palette. It promotes these tokens out of `mir/` into a
shared design layer.

### 1.9 Layer state today

`config/layerConfig.js` — a per-route map of three booleans
(`orthophoto`, `roads`, `boundaries`). `PanelLayer` renders them as checkboxes in
a popover. That is the entire layer system.

---

## 2. Problems identified

Ordered by how much they cost the user.

**P1 — Underspeed shows fabricated data.** (1.3) Highest severity in the whole
audit: a page in production that answers an operational question with
`Math.random()`.

**P2 — The map is not the primary surface; the filter modal is.** Every historical
page starts with a blocking 972-line modal over the map. The user configures
context blind, applies, and only then sees anything. There is no way to adjust a
time range while looking at the result.

**P3 — Full-fleet animation is the only historical mode.** Wrong default. A user
asking "where did the fleet actually drive today?" is forced into a video player
that animates one hauler and requires watching in real time to see anything. The
spatial answer is available instantly and is never shown.

**P4 — The timeline is a video seek bar.** `PlaybackControlsV2` maps progress
0–100 onto `totalDataPoints * 1000 / playbackSpeed`. It conveys no information
about *when* anything happened. A user cannot see that the fleet was dense at
06:00 and idle at 11:00.

**P5 — POJO inflation.** Every historical row becomes an object with 12 fields
plus an ISO string. At 1 row/second/device, one device-day is 86,400 objects;
20 devices is 1.7M objects and roughly 1.7M ISO strings. This is why the trace
cannot show more than one hauler at a time today.

**P6 — Durasi In Pit blocks the main thread** with an O(points × polygons) turf
scan (1.4).

**P7 — Layer management is three checkboxes** (1.9) for a product whose value is
spatial context: orthophoto, boundaries, roads, pit polygons, traces, live units,
editing overlays.

**P8 — Three near-duplicate map integrations.** `MapContainer.jsx` (maplibre +
deck.gl, loads a redundant second basemap raster), `MapContainerLite.jsx`
(deck.gl only), and `MIRGeofence`'s bespoke layer stack. Each page re-implements
viewState, layer toggles and camera behaviour.

**P9 — Speed classification is hardcoded in a page file** (`UnderspeedPeta.jsx:12`)
and duplicated as a `getSpeedColor` if-chain at line 20 and again inside
`useDeckGlLayers.js:22`.

**P10 — No spatial selection.** A user cannot say "these trucks, in this area".
Selection is a dropdown only.

---

## 3. Reference products and patterns researched

For each: the problem it solves, why it works, what applies here, what must not
be copied.

### Google Maps — timeline / "your places" history
- **Solves**: showing a full day of movement without animating it.
- **Works because**: the static trace is the answer; time is a filter over it,
  not a playback clock. Density is legible because overlapping samples darken.
- **Apply**: dot trace as the default historical view; time as a brush.
- **Do not copy**: consumer chrome, rounded pill overlays, the "timeline" as a
  scrolling card feed.

### Google Earth — layer tree + opacity
- **Solves**: many overlapping spatial datasets with different authority.
- **Works because**: one persistent tree, per-layer opacity, explicit ordering.
- **Apply**: persistent layer manager with visibility + opacity + order.
- **Do not copy**: nested folders four levels deep; 3D tilt as a default.

### ArcGIS Map Viewer — layer properties and symbology panel
- **Solves**: separating "what layers exist" from "how this layer is drawn".
- **Works because**: selecting a layer swaps the right panel to that layer's
  styling, so the map is never covered by a settings dialog.
- **Apply**: layer manager (left of inspector) + contextual style panel; the
  speed-band editor for Underspeed is exactly this pattern.
- **Do not copy**: the full symbology system, expressions, arcade, joins,
  analysis tools. This is a mine operations tool, not a GIS authoring suite.

### Felt / CARTO — lasso and spatial selection
- **Solves**: "these features, in this area" without knowing their IDs.
- **Works because**: draw a shape, the selection updates everywhere else.
- **Apply**: lasso over the dot trace to select units spatially, feeding the same
  selection model as the unit list.
- **Do not copy**: collaborative cursors, comments, presentation mode.

### Kepler.gl — time brush over a binned histogram
- **Solves**: exactly problem P4. A histogram of record counts per time bin with
  a draggable range brush; the map filters to the brushed window.
- **Works because**: the histogram *is* the density readout and the control at
  the same time, and the filter runs on the GPU so brushing is instant.
- **Apply**: this is the direct model for the V3 temporal density strip.
- **Do not copy**: the config-panel-first layout (Kepler is an analyst tool where
  the map is secondary to the config sidebar; here the map is primary), the dark
  theme, arbitrary layer-type switching exposed to operators.

### Samsara / Geotab — trip replay and event inspection
- **Solves**: an operator needs the *evidence* for an event, not a general
  exploration tool.
- **Works because**: the list of events is primary, each row zooms the map to
  that event, and playback is scoped to one trip.
- **Apply**: Durasi In Pit's dwell events and Underspeed's violations are event
  lists with map evidence, not dashboards. Playback is per-event.
- **Do not copy**: the score/gamification framing, driver-safety KPI cards.

### deck.gl `TripsLayer` (Uber's own trip animation)
- **Solves**: animated multi-vehicle trails with `currentTime` as a GPU uniform.
- **Works because**: geometry uploads once, animation is one uniform per frame.
- **Apply**: keep it — for the focused playback subset only.
- **Do not copy**: using it for the entire historical fleet, which is what V2 does.

### Synthesis

None of these is copied wholesale. The composite is:

> Google Maps' *static trace as the answer*, Kepler's *histogram-as-brush*,
> ArcGIS's *layer/style separation*, Felt's *lasso*, Samsara's *event list with
> map evidence*, and deck.gl's `TripsLayer` demoted to a focused mode.

---

## 4. Proposed information architecture

Current navigation (`components/layout/navigation.js`) groups by implementation
history: "Live" and "Playback". "Playback" is wrong as a group name once playback
is a secondary interaction.

```
SMARTD MH02
│
├─ OPERASI                        (what is happening now)
│   └─ Live Unit                  /v3/operasi/live
│
├─ ANALISA HISTORIS               (what happened, shared historical engine)
│   ├─ Cycle Time                 /v3/historis/cycle-time
│   ├─ Underspeed                 /v3/historis/underspeed
│   ├─ Durasi In Pit              /v3/historis/durasi-in-pit
│   └─ Datalog Record             /v3/historis/datalog
│
└─ PETA & WILAYAH                 (spatial context the analyses run against)
    ├─ Layer & Orthophoto         /v3/peta/layer
    └─ Area Operasi               /v3/peta/area
```

Decisions and rationale:

- **"Playback" → "Analisa Historis".** The group's job is historical analysis;
  playback is one interaction inside it. Naming the group after the least-used
  interaction is why users expect a video player.
- **The four historical pages share one context** (district, time range, units).
  Grouping them makes that shared context legible and lets V3 *preserve the
  context across navigation* — switch from Cycle Time to Underspeed and keep your
  selection. Today each page re-opens the filter modal from scratch.
- **GIS is its own group, not a settings page.** Polygons carry operational rules
  (speed plans) that the analyses consume. It is a data-authoring surface.
- **RTK Quality stays where it is** (`/playback/rtk-quality`) until Phase F. It is
  a device-health view, not fleet analysis; folding it into "Analisa Historis"
  would be the kind of meaningless module-shuffling the brief forbids.
- **MIR is untouched.** It is a separate service and product with its own
  navigation, already hidden in production.
- **No "Dashboard" landing page.** `pages/Dashboard.jsx` is 12 lines and empty.
  V3 lands on Live Unit, as today. A summary dashboard nobody asked for is the
  archetypal filler module.

Left navigation is a **48 px icon rail with labels on hover**, expanding to 200 px
on pin. Rationale: three groups and nine items do not justify permanent
horizontal space on a map-primary product at 1366 px laptop width.

---

## 5. Core interaction model

One shell, composed differently per page.

```
┌──┬──────────────────────────────────────────────────────────────────┐
│  │ CONTEXT BAR   Distrik ▾ │ 12 Agu 06:00 – 18:00 ▾ │ 8 unit ▾ │ ⟳ │ 40px
│  ├──────────────────────────────────────────────────────────────────┤
│ R│                                                    ┌───────────┐ │
│ A│                                                    │ LAYERS    │ │
│ I│                    MAP WORKSPACE                   │  or       │ │
│ L│                  (primary surface)                 │ INSPECTOR │ │
│  │                                                    │   320px   │ │
│48│  ┌────────┐                                        │           │ │
│px│  │ legend │                          [⊞][✎][⤢][◎] └───────────┘ │
│  │  └────────┘                          map toolbar                 │
│  ├──────────────────────────────────────────────────────────────────┤
│  │ ▁▂▃▆█▇▅▃▂▁▁▂▄▆█▆▄▂▁    TEMPORAL DENSITY + BRUSH      [▶ Putar]  │ 88px
└──┴──────────────────────────────────────────────────────────────────┘
```

**Filters live in the context bar, not a modal.** This is the biggest interaction
change and it directly fixes P2. The bar shows the three things that define what
is on screen; clicking one opens a popover *anchored to it* while the map stays
visible. Advanced controls that today justify the modal — source comparison,
per-hauler S3 availability — move into a "Lanjutan" popover off the unit picker,
reusing the existing components.

**Unit selection: three affordances, one model.**

| Affordance | For | Writes to |
|---|---|---|
| Context bar picker (search, multi-select, availability badges) | "I know which units" | `selection.deviceIds` |
| Click a trace or marker on the map | "That one" | `selection.deviceIds` |
| Lasso tool on the map toolbar | "Whatever drove *here*" | `selection.deviceIds` |

All three converge on one selection set, reflected simultaneously in the picker
chip count, the map highlight, and the inspector. Selecting 20 of 200 units is a
search-and-check task in the picker; selecting "the trucks that used this ramp"
is a lasso task. Both are real operational questions, so both exist.

**The right panel is one slot with two occupants**: the Layer Manager or the
Feature Inspector. They never coexist — 320 px is not enough for both, and
splitting it would produce two cramped columns. The map toolbar's layers button
swaps the slot; clicking a feature swaps it to the inspector.

**The temporal strip is always present on historical pages** and is the primary
temporal control. Playback is entered explicitly with "Putar terpilih", which is
disabled until a unit is selected. That disabled state is deliberate product
messaging: playback is for a subset, never for everything.

**Journey: fleet trace → one truck → focused playback.**

```
1. Context bar: distrik + 12 Agu 06:00-18:00 + "semua DT"    → Terapkan
2. Dot trace paints. Dense corridors are visibly dark.        (< 2 s target)
3. Temporal strip fills: a trough at 11:00-12:00 is obvious.
4. User brushes 10:30-12:30.  Trace filters on the GPU.       (instant)
5. User lassos the dots parked near the workshop → 3 units selected.
6. Inspector lists those 3 with their sample counts.
7. "Putar terpilih" → full-res chunks for 3 devices, 2 hours.
8. Animation runs over the still-visible static trace.
```

---

## 6. Cycle Time V3 workflow

**Business question**: where did the fleet travel, how was that movement
distributed in space and time, and what does one truck's cycle look like in
detail?

### 6.1 Default view — dot trace

On Terapkan, every selected unit's historical samples render as points. No
animation. Overlapping samples accumulate opacity, so:

- a haul road becomes a dark continuous corridor,
- a queue at the loader becomes a dense blob,
- a one-off detour stays a faint thin line.

That is the density readout. It requires no extra layer and no aggregation.

Colour by default encodes **unit identity** (categorical, from a fixed
colourblind-safe ramp), because Cycle Time's question is "which truck went
where". Underspeed reuses the identical layer with colour bound to speed band
instead (§7).

### 6.2 Layer selection — evaluated, not assumed

| Candidate | Verdict | Reasoning |
|---|---|---|
| **`ScatterplotLayer` + binary attributes + `DataFilterExtension`** | **Chosen** | One instance per sample, positions straight from `Float64Array` with no JS conversion. `DataFilterExtension` filters by timestamp *and* speed band **on the GPU**, so brushing the timeline costs zero CPU and no re-upload. Per-point colour is required by Underspeed. Picking gives us click-to-select. |
| `PathLayer` | Rejected | Needs per-path JS structures and CPU tessellation; a path also *hides* the thing we want to see — a stationary truck produces a zero-length segment, whereas a dot pile is immediately readable as dwell. |
| `TripsLayer` | Kept, but scoped | Correct for animated trails; wrong as a static full-fleet representation. Used only by the focused playback runtime (§14). |
| `HeatmapLayer` | Rejected | Unquantified glow. Operations needs "how many samples", not "how hot". |
| `ScreenGridLayer` | **Secondary mode** | GPU-aggregated, gives a *counted* grid with a real legend. Offered as an explicit "Kepadatan" toggle for zoomed-out multi-day ranges where individual dots stop being distinguishable. |
| `HexagonLayer` | Rejected | CPU aggregation on the main thread; `ScreenGridLayer` gives the same answer on the GPU. |
| `GeoArrowScatterplotLayer` (`@loaders.gl/geoarrow`) | Deferred | Would remove even the typed-array copy. Evaluate in Phase F once the binary path is proven; not worth the API risk in the first slice. |

All of these packages are **already installed** (`@deck.gl/aggregation-layers`,
`@deck.gl/extensions`, `@loaders.gl/geoarrow` are present in `node_modules` via
the `deck.gl` meta-package). V3's rendering plan adds no dependency.

### 6.3 Temporal density strip

Bins the selected range into fixed buckets (60 bins across the range; hourly for
a day, ~2 min for a 2-hour range) and draws sample counts per bin as a bar
sequence. Stacked by unit when ≤8 units are selected, aggregate above that.

Interactions:
- **Drag across bins** = brush the analysis window. Map filters on the GPU.
- **Click a bin** = snap the window to that bin.
- **Double-click** = clear the brush, back to the full range.

Bin counts come from the already-decoded epoch column — a single pass over a
`Float64Array` in the worker, returned as one small `Uint32Array`. No extra
request. The backend's `availableHours` manifest
(`PlaybackV2StatusResponse.AvailableHours`) provides the coarse skeleton before
chunk data lands, so the strip is never empty.

### 6.4 Focused playback

Entering playback does **not** unload the static trace. The trace dims to 35%
opacity and stays as spatial context; the animated subset draws over it. Exiting
restores it. Nothing is re-fetched on either transition.

Playback loads full-resolution chunks for the selected devices over the brushed
window only, reusing `ensureSelectedHaulerChunks`' hour-chunk mechanism —
generalised from one hauler to N.

### 6.5 Inspector

Selecting a unit shows: unit no, device id, sample count in window, first/last
sample, distance travelled, average speed, and the existing cycle summary fields
(`toLegacySummary`: ritase, loaded/empty distance and duration, avg cycle time).
These are existing computed values, unchanged.

---

## 7. Underspeed workflow

Same engine, different semantic binding. **No second map architecture, no second
playback engine, no second data path.**

### 7.1 What changes relative to Cycle Time

Exactly two things:

1. `getFilterValue` carries `[timestampMs, speed]` instead of `[timestampMs]`, so
   the GPU filters by time *and* speed band simultaneously.
2. Point colour is looked up from the active speed-band table instead of unit
   identity.

Both are per-point attributes computed once in the worker into a `Uint8Array` of
band indices. Changing a band's colour rewrites a 5-entry colour array — a
uniform update, not a data rebuild. Changing a band's *threshold* rewrites the
`Uint8Array` in the worker; still no refetch.

### 7.2 Speed bands — configurable, with the current values as defaults

The current hardcoded bands (`UnderspeedPeta.jsx:12-18`) become the seeded
default so existing operational meaning is preserved:

| Band | Range (km/h) | Colour today | Meaning |
|---|---|---|---|
| Berhenti | = 0 | `#dc2626` | Stopped |
| Sangat lambat | 1–19 | `#f97316` | Under target |
| Lambat | 20–29 | `#eab308` | Below plan |
| Normal | 30–35 | `#22c55e` | On plan |
| Cepat | > 35 | `#3b82f6` | Above plan |

The editor lives in the right panel as a layer-style panel (the ArcGIS pattern
from §3): a row per band with editable lower bound, colour swatch and label; add
and remove rows; drag to reorder. Bounds are validated to stay contiguous and
non-overlapping — the operator edits *boundaries*, not independent min/max pairs,
which makes gaps structurally impossible.

Bands are persisted per district. The polygon `speed_plan` attribute (§13) is
shown as a reference line in the editor so an operator can see whether their
bands agree with the configured plan for the area they are looking at.

### 7.3 Violation events, not just coloured dots

A run of consecutive samples in a below-plan band inside a polygon that has a
speed plan is a **violation event**. The inspector lists these (unit, area,
start, duration, min/avg speed), each row zooming the map to the event and
offering per-event playback. This is the Samsara pattern from §3, and it is what
makes the page operational rather than decorative.

Event derivation runs in the worker over the same typed arrays, reusing the
run-length logic pattern from Durasi In Pit (§8).

### 7.4 Migration note — behaviour change, flagged

Today this page shows random numbers. V3 shows real data. Values on screen will
change completely. This is a defect fix, not a business-logic change, but it will
look like one to anyone who has been reading the current page, and it must be
communicated before release.

---

## 8. Durasi In Pit workflow

**Business question**: which units entered which operational areas, when, and for
how long.

### 8.1 Logic — moved, not changed

The dwell state machine from `DurasiPitStopPeta.jsx:108-185` is lifted verbatim
into the worker, operating on typed arrays instead of objects. `MIN_DURATION_SECONDS
= 30`, `MERGE_GAP_SECONDS = 60`, the A→B transition rule and the open-event
closure rule are preserved exactly (§1.4).

Two implementation improvements that do not alter results:

- **Bounding-box prefilter.** `turf.booleanPointInPolygon` is only called when
  the sample falls inside a polygon's precomputed bbox. For a fleet crossing a
  mine with a dozen pit polygons this eliminates the large majority of calls; the
  answer is identical because the bbox test is a conservative superset.
- **Off the main thread.** The scan runs in the worker. Output is an event array
  — hundreds of records, not millions.

Polygon source moves from the static KML to the Area Operasi store (§9), with the
KML retained as a fallback import path so nothing breaks before areas are
migrated.

### 8.2 Presentation

Not four KPI cards. Three coordinated surfaces answering *where*, *when*, and
*prove it*:

**Map — WHERE.** Pit polygons filled by total dwell time (sequential ramp, with
a legend in minutes). Each dwell event is a dot at the entry point, radius scaled
by duration. Selecting a polygon filters everything else to that area.

**Temporal strip — WHEN and HOW LONG.** In this page the strip switches from a
density histogram to a **dwell timeline**: one row per unit, horizontal bars
spanning each event's entry→exit, coloured by polygon. Occupancy patterns,
overlaps and queues become directly visible — five bars stacked at the same
polygon at 07:00 is a queue, and no chart type states that as plainly.

```
        06    07    08    09    10    11    12
DT-041  ▐███▌      ▐█▌        ▐████▌
DT-052    ▐██▌        ▐███▌       ▐█▌
DT-063        ▐█████▌      ▐██▌
```

**Inspector — PROVE IT.** The event table (unit, area, entry, exit, duration),
sortable, exportable, each row zooming the map and offering playback of that
event's window. The evidence layer.

Unit comparison is served by sorting the dwell timeline by total dwell rather
than by a separate ranking chart.

---

## 9. GIS / layer workflow

### 9.1 Layer Manager

A persistent panel in the right slot, listing the layers that exist in this
product — not a generic GIS tree.

```
▾ Data operasi
   ◉ Jejak historis          [────●──] 100%   ⋮
   ○ Kepadatan (grid)        [──●────]  60%   ⋮
   ◉ Unit live                                ⋮
▾ Wilayah
   ◉ Area operasi            [───●───]  80%   ⋮  ✎
   ◉ Boundary distrik        [──●────]  50%   ⋮
   ○ Jalan tambang                            ⋮
▾ Dasar
   ◉ Orthophoto  BRCB 2026-06 ▾  [──●───] 90% ⋮
```

Per layer: visibility, opacity, overflow menu (zoom to extent, metadata, style).
Ordering is fixed within groups — arbitrary reordering of an orthophoto above the
traces has no valid operational use and only creates broken states. Group order
is fixed: data over wilayah over dasar.

The orthophoto row exposes a **version selector**. The ortho service already
returns multiple layers per district with `uploadedAt`; today
`MapContainerLite.jsx:60-62` silently picks the newest and discards the rest.
Comparing this month's ortho against last month's is a real operational need that
the data already supports and the UI hides.

### 9.2 Area Operasi

The polygon management surface, built on `MIRGeofence`'s existing
`EditableGeoJsonLayer` machinery (§1.7).

- List of areas with type, last modified, and rule summary.
- Select → highlight on map, inspector shows attributes (§13).
- Draw / modify / translate modes on the map toolbar, only while an area is in
  edit state.
- Explicit save; `Esc` cancels; unsaved changes block navigation.
- KML import/export retained (`utils/kml.js`).

### 9.3 Polygon from historical trace

The workflow the brief calls out as future-facing.

**Manual path** — draw over the visible dot trace, review, attribute, save. The
trace is already on screen, so this needs only the draw tool. Available in V3
Phase F.

**Recommendation path** — *buffered trajectory union*, chosen over the alternatives:

```
selected trace points (typed arrays, in worker)
   │
   ├─ 1. drop samples outside the brushed time window
   ├─ 2. drop samples above a speed threshold      ← "where trucks worked",
   │                                                  not "where they drove past"
   ├─ 3. snap to a ~5 m grid, keep cells with ≥ N samples   ← density threshold
   ├─ 4. turf.buffer each surviving cell by R metres
   ├─ 5. turf.union the buffers
   └─ 6. turf.simplify (tolerance ~2 m)
   │
   └─→ candidate polygon → user edits vertices → user attributes → user saves
```

**Why buffered union rather than concave hull / alpha shape.** Both are available
(`turf.concave` exists in the installed 6.5). The deciding factor is
explainability: a buffered union's parameters are *R metres around where trucks
actually were* and *at least N samples per cell*. An operator can reason about
both, and about why a piece of the polygon appeared. Alpha shape's α has no
operational meaning, and small α changes produce large topology changes —
including holes and disconnected pieces — that an operator cannot predict or
justify. Concave hull remains available as a secondary "rapatkan" option for
users who want a tighter outline, but it is not the default.

No machine learning. The geometry is a five-step deterministic pipeline over data
we already hold in typed arrays, using functions already in the dependency tree.
Adding a model here would make the result less explainable and no more correct.

**Never auto-saved.** The candidate enters the normal edit state with all vertices
handles live, marked "Usulan — belum disimpan", with the generating parameters
shown and adjustable. Accepting is an explicit save.

---

## 10. Proposed component architecture

Derived from the workflows above, not from a theoretical system.

```
app/
├─ AppShell                 rail + context bar + content slot
├─ AppRail                  icon navigation, 48px, hover labels
└─ ContextBar               distrik / rentang waktu / unit  (historical pages)

map/
├─ MapWorkspace             ONE deck.gl surface. Uncontrolled camera.
│                           Owns viewState ref, quantised zoom, camera commands.
├─ MapToolbar               layers · draw · lasso · measure · reset
├─ MapLegend                bound to the active colour encoding
└─ layers/                  pure factories: (state) => Layer[]
   ├─ useBasemapLayers      orthophoto TileLayer (+ version), boundaries, roads
   ├─ useAreaLayers         operational polygons, incl. edit state
   ├─ useTraceLayers        dot trace (binary) + density grid
   ├─ usePlaybackLayers     TripsLayer + markers for the focused subset
   └─ useLiveLayers         MQTT units + short trails

panel/
├─ PanelSlot                the single right slot; hosts one of:
├─ LayerManager
├─ FeatureInspector         unit · area · event
└─ style/
   ├─ SpeedBandEditor
   └─ AreaAttributeForm

temporal/
├─ TemporalStrip            container + brush interaction
├─ DensityHistogram         Cycle Time / Underspeed
├─ DwellTimeline            Durasi In Pit
└─ PlaybackBar              transport controls, only in playback mode

data/
├─ UnitPicker               search, multi-select, S3 availability badges
├─ TimeRangePicker          shortcuts + explicit range
└─ DataTable                virtualised; Datalog + evidence tables

foundation/
├─ tokens.js                promoted from mir/operasi/mirTokens.js
└─ primitives               Button, Field, Select, Popover, Panel, Chip
```

Boundary rule: `map/layers/*` are pure functions of state to deck.gl layers. They
never hold React state and never call stores directly — the workspace passes what
they need. This is what makes composing a page a matter of choosing layer
factories rather than writing a new map.

---

## 11. Map / layer architecture

```
                    ┌──────────────────────────────┐
                    │        MapWorkspace          │
                    │  one <DeckGL>, one WebGL ctx │
                    │  uncontrolled camera         │
                    └──────────────┬───────────────┘
                                   │ layers = [...]
        ┌──────────────┬───────────┼────────────┬──────────────┐
        │              │           │            │              │
   ┌────▼────┐   ┌─────▼────┐ ┌────▼─────┐ ┌────▼─────┐  ┌─────▼─────┐
   │ Basemap │   │  Areas   │ │  Trace   │ │ Playback │  │  Editing  │
   │ ortho   │   │ polygons │ │ dots     │ │ trips    │  │ handles   │
   │ boundary│   │ + rules  │ │ + grid   │ │ + markers│  │ (on demand)│
   │ roads   │   │          │ │          │ │          │  │           │
   └─────────┘   └──────────┘ └──────────┘ └──────────┘  └───────────┘

   always          GIS +          historical    playback      GIS edit
   available       analyses       pages         mode only     mode only
```

Page composition:

| Page | Basemap | Areas | Trace | Playback | Editing |
|---|---|---|---|---|---|
| Live Unit | ✓ | ✓ (read) | — | — | — |
| Cycle Time | ✓ | ✓ (read) | ✓ | on demand | — |
| Underspeed | ✓ | ✓ (read) | ✓ speed-coloured | on demand | — |
| Durasi In Pit | ✓ | ✓ dwell-filled | ✓ | per event | — |
| Area Operasi | ✓ | ✓ editable | ✓ (reference) | — | ✓ |

Live Unit adds its own `useLiveLayers`. Every page uses the same workspace, the
same camera behaviour, the same toolbar and the same layer manager.

`MapContainer.jsx`, `MapContainerLite.jsx` and MIRGeofence's inline stack are not
modified. V3 uses `MapWorkspace`; the old ones stay in place for V1/V2/MIR.

---

## 12. State architecture

The governing rule, derived from what actually went wrong in V2:

> **Nothing that changes faster than ~1 Hz, and nothing larger than a few
> kilobytes, may live in a React store.**

```
┌─────────────────────────────────────────────────────────────┐
│ historyStore  (Zustand)          — small, low frequency     │
│   context   { district, rangeStart, rangeEnd, deviceIds }   │
│   window    { brushStart, brushEnd }                        │
│   selection { deviceIds[], areaId, eventId }                │
│   layers    { visibility, opacity, orthoVersion }           │
│   speedBands[]                                              │
│   status    { queryId, state, progress, error }             │
└─────────────────────────────────────────────────────────────┘
        │ ids and ranges only — never sample data
        ▼
┌─────────────────────────────────────────────────────────────┐
│ traceRegistry  (plain module, NOT Zustand)                  │
│   Map<deviceId, {                                           │
│     n, epochMs:F64, lat:F64, lon:F64, speed:F32,            │
│     plmStatus:F32, band:U8, position:F64 (interleaved)      │
│   }>                                                        │
│   + a version counter React subscribes to via               │
│     useSyncExternalStore                                    │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ playbackRuntime  (plain module — already exists as          │
│                   services/playbackAnimationRuntime.js)     │
│   playhead: number, RAF-frequency, ref + pub/sub            │
└─────────────────────────────────────────────────────────────┘
```

Why `traceRegistry` is not Zustand: every Zustand `set()` walks every
subscriber's selector app-wide. Typed arrays are also structurally unsuited to
immutable-update semantics — the whole point is that the buffer identity is
stable so deck.gl does not re-upload. A version counter plus
`useSyncExternalStore` gives React exactly the notification it needs and nothing
more. This is the same reasoning that already moved the playhead out of Zustand,
applied to the data.

`cycleTimeStore.js` is not modified. V3 introduces `historyStore` alongside it;
V1/V2 keep using the old one until they are retired.

---

## 13. Dot-trace performance architecture

```
S3 (.gz / .parquet, ~210 cols)
      │  DuckDB httpfs — unchanged
      ▼
PlaybackV2Service ── serving-generation Parquet fast path where materialised
      │
      │  Arrow IPC  (application/vnd.apache.arrow.stream)   — schema unchanged
      ▼
fetch → ArrayBuffer ──transfer──▶ ┌──────────── WORKER ────────────┐
                                  │ tableFromIPC                    │
                                  │ → typed arrays  (ALREADY DONE   │
                                  │    at worker.js:24-49)          │
                                  │ → interleaved position F64[2n]  │
                                  │ → band index U8[n] (speed)      │
                                  │ → colour U8[4n]                 │
                                  │ → time bin counts U32[60]       │
                                  │ ✗ DELETE the POJO loop (62-81)  │
                                  └──────────┬──────────────────────┘
                                             │ postMessage([...buffers])
                                             │ TRANSFERABLE — zero copy
                                             ▼
                                  traceRegistry.set(deviceId, cols)
                                             │
                                             ▼
   new ScatterplotLayer({
     data: { length: n, attributes: {
       getPosition:    { value: cols.position, size: 2 },
       getFillColor:   { value: cols.color,    size: 4, normalized: true },
       getFilterValue: { value: cols.filter,   size: 2 }   // [epochMs, speed]
     }},
     extensions: [new DataFilterExtension({ filterSize: 2 })],
     filterRange: [[brushStart, brushEnd], [speedMin, speedMax]],
     radiusMinPixels: 1.5, radiusMaxPixels: 4
   })
```

The deletion at worker.js:62-81 is the whole change. Everything upstream of it
already produces what V3 needs.

**Budget.** One `ScatterplotLayer` instance with position (F64×2), colour
(U8×4) and filter (F32×2) costs ~28 bytes on the GPU per sample.

| Scope | Samples | GPU |
|---|---|---|
| 1 unit × 12 h | 43 k | ~1.2 MB |
| 20 units × 12 h | 864 k | ~24 MB |
| 50 units × 24 h | 4.3 M | ~121 MB |
| 200 units × 24 h | 17 M | ~480 MB — **over budget** |

**Decimation policy.** A hard client budget of **3 M rendered samples**. Above it,
the worker strides the arrays (keeping every k-th sample) to fit. Stride is
reported in the legend — "1 dari 4 sampel" — because silently showing less data
than requested is the kind of thing that makes an operational tool untrustworthy.
Full resolution is always used for the focused playback subset, which is small by
construction.

**Explicitly avoided**: React nodes per record; POJOs per record; `new Date()` per
record; string building per record; array copies on brush (the GPU filters);
re-upload on colour change (uniform/attribute swap only).

---

## 14. Focused-playback architecture

```
RAF tick
   │
   ├─ playbackRuntime.setPlayhead(t)      ← module ref + pub/sub, not Zustand
   │
   ├─ MapWorkspace re-renders (only this component subscribes)
   │     │
   │     ├─ TripsLayer.currentTime = t              ← ONE GPU uniform
   │     │   geometry uploaded once at playback entry
   │     │
   │     └─ marker slots mutated in place, positionVersion++
   │         stable data array → only the position attribute regenerates;
   │         TextLayer glyph layout is NOT re-run
   │
   └─ every ~1 s: throttled store write for UI text
```

Explicitly outside the frame loop: sorting, dedup, fetch parsing, timeline
rebuilds, history filtering, chunk merging, React dashboard updates.

Frame cost scales with **selected playback units**, not total historical rows.
The static trace stays resident and dimmed; it costs one draw call and does not
change during playback.

The stable-slot / `positionVersion` mechanism and the uncontrolled camera are
already implemented in the current V2 work and carry over unchanged.

---

## 15. Reusable vs replace decisions

### Reuse as-is

| Asset | Why |
|---|---|
| `Services/PlaybackV2*`, `DuckDbSourceReader`, `DatalogServingMaterializer` | Correct two-tier design, Arrow already the wire format. No change needed. |
| Arrow schema (`PlaybackV2ArrowWriter.cs:16-28`) | Fixed-width columnar, exactly what binary attributes want. |
| `services/playbackAnimationRuntime.js` | Correct primitive, correct rationale. |
| `@deck.gl-community/editable-layers` usage in `MIRGeofence` | Working polygon editor; lift the pattern. |
| `utils/kml.js`, `hooks/useKml.js` | KML parse/serialise, already memoised. |
| `components/mir/operasi/mirTokens.js` | Promote to `foundation/tokens.js`. Palette and encoding principles are sound. |
| FilterModal's *logic*: shortcuts, S3 availability, source comparison, WITA offset | Real operational value; re-host in the context bar. |
| Durasi In Pit dwell rules (§1.4) | Business definitions. Preserved exactly. |
| Underspeed default bands (§7.2) | Existing operational meaning; seeded as defaults. |
| `DatalogRecord.jsx` | Audit only (§ below). Not rewritten. |

### Reuse with surgery

| Asset | Change |
|---|---|
| `playbackChunkDecoder.worker.js` | **Delete lines 62-81** (POJO build). Transfer typed arrays instead. Add band index, colour and bin-count outputs. This one edit is the core of §13. |
| `ensureSelectedHaulerChunks` | Generalise from one hauler to N selected devices; write into `traceRegistry` instead of rebuilding a POJO array. |
| `useDeckGlLayers.js` | Split into the per-concern layer factories of §10. The boundary/road/cluster logic is fine; the monolithic single hook with `viewState` in its dependency array is not. |
| `IconMarker.js` | Keep; already carries the `positionVersion` escape hatch. |

### Replace

| Asset | Why |
|---|---|
| `pages/UnderspeedPeta.jsx` | Mock data (§1.3). Nothing to preserve but the band values. |
| `config/layerConfig.js` (3 booleans) | Insufficient for V3's layer set. |
| `PanelLayer` checkbox popover | Replaced by the Layer Manager. |
| `FilterModal` *as a modal* | Blocks the map (P2). Logic survives, container does not. |
| `PlaybackControls` progress model | Progress-as-percentage-of-row-count replaced by real epoch time, which the timeline needs anyway. |
| Main-thread turf scan in `DurasiPitStopPeta` | Moves to worker (§8.1). Results identical. |

### Do not touch

`CycleTimePeta.jsx` (V1), `CycleTimePetaV2.jsx` (V2), `MapContainer.jsx`,
`MapContainerLite.jsx`, `cycleTimeStore.js`, all `/mir/*` pages,
`RTKQuality.jsx`, `DeviceServiceManagement.jsx`. V3 is additive until it reaches
parity.

---

## 16. Implementation phases

**Phase A — Audit.** Complete; this document.

**Phase B — Product research.** Complete; §3–§5.

**Phase C — Architecture.** Complete; §10–§14.

**Phase D — V3 foundation.** *(no user-visible feature)*
- `foundation/tokens.js` promoted from `mirTokens.js`.
- `AppShell`, `AppRail`, `ContextBar`, `PanelSlot`.
- `MapWorkspace` with uncontrolled camera and the layer-factory contract.
- `historyStore`, `traceRegistry`.
- Worker rewritten to emit transferable columns.
- Routes mounted under `/v3/*`. Nothing existing is touched.
- **Exit criterion**: `/v3/historis/cycle-time` renders the orthophoto, boundaries
  and an empty workspace; panning produces zero React renders of the page.

**Phase E — Cycle Time V3, the vertical slice.**
- Context bar with real unit/time selection.
- Dot trace from binary attributes.
- Temporal density strip with brush → `DataFilterExtension`.
- Selection: picker, map click, lasso.
- Layer Manager, legend, inspector.
- Focused playback for the selected subset.
- **Exit criteria** (all must hold before Phase F starts):
  - 20 units × 12 h renders in < 2 s after data arrives.
  - Brushing the timeline is visually instant (no JS work per brush frame).
  - Panning: 0 page re-renders. Playback: page ~1/s, map ~60/s.
  - An operator who has not seen it can go context → trace → selection →
    playback without being told how.

**Phase F — Propagate.** In this order, because each reuses the previous:
1. **Underspeed** — smallest delta from Cycle Time (§7.1); also fixes the most
   severe defect in the product.
2. **Durasi In Pit** — adds the worker dwell scan and the dwell timeline.
3. **Area Operasi** — polygon editing, attributes, then trace-derived polygons.
4. **Live Unit** — port to `MapWorkspace`, keep MQTT behaviour untouched.
5. **Datalog Record** — consistency pass only (shell, tokens, context bar). The
   table itself is audited, not rewritten: virtualisation, sticky header/first
   column, and column grouping are the specific items to verify at 1623 lines.

**Phase G — Retire.** Only after V3 parity: remove V1/V2 routes,
`MapContainer.jsx`, `MapContainerLite.jsx`, and then `maplibre-gl` +
`react-map-gl` (~800 KB) and the `mapbox-gl` alias from `vite.config.js`.

---

## 17. Risks and assumptions

**R1 — Ortho tile service is a hard bottleneck.** `OrthoService.cs:316-375` forks a
`gdal_translate` process per tile, on `cpu: 300m`, one replica, with an ephemeral
cache (`CYCLETIME_STACK_AUDIT_V3.md` §2). V3 makes the map more central, so this
gets *more* exposure, not less. The client-side `extent` + `maxZoom` fix already
landed and removes the out-of-bounds request storm; the pyramid pre-generation
(PMTiles on S3/CloudFront) remains an unscheduled ops task. **V3 does not depend
on it**, but the perceived quality of every V3 screen does.

**R2 — GPU memory on operator hardware.** The 3 M sample budget (§13) assumes a
discrete or modern integrated GPU. Unverified on actual operator machines. The
budget is a constant in one place and the stride is reported in the legend, so
the failure mode is degraded resolution, not a crash.

**R3 — WebGL context quality is unverified.** The V2 work was tested inside WSL2
where WebGL may be software-rendered, invalidating every frame measurement taken
so far. Phase D must confirm hardware acceleration on a real operator machine
before any performance exit criterion is accepted.

**R4 — `DataFilterExtension` limits.** `filterSize` maxes at 4. Time + speed uses
2, leaving headroom, but a future third and fourth simultaneous filter dimension
would exhaust it.

**R5 — Preview sampling semantics.** The backend returns `sampling` counts per
class and may truncate (`truncated`, `retainedCount`, `totalCount`). V3 must
surface the stride honestly (§13). Assumption: `sampling` classes correspond to
device classes; **to be confirmed against `PlaybackV2Service` before Phase E.**

**R6 — Areas have no backend yet.** Pit polygons live in a static KML (§1.4);
MIR geofences have their own service. Area Operasi needs a persistence story.
Assumption: the geofence-management service (proxied at `/geofence-management` in
`vite.config.js`) is the right home. **To be confirmed before Phase F.3.**

**R7 — Timezone.** Everything is WITA (UTC+8), applied by appending `+08:00` to
naive strings (`cycleTimeStore.js:51`) and requested per `witaHour`. V3 changes
nothing here. The temporal strip's bin labels must be WITA, and any drift would
silently misplace every event. Flagged as the single highest-consequence
correctness risk in the temporal work.

**R8 — Colour-only encoding.** The speed bands are colour-only today. The house
principle is "bentuk dulu, warna penguat" (§1.8). At 1.5–4 px dot radius, shape
encoding is not available. Mitigation: the band ramp is ordered and
colourblind-checked, and the count per band is shown numerically in the legend so
the classification is readable without relying on hue discrimination.

**A1** — Districts are limited to ~3 and change rarely.
**A2** — Desktop, 1366 px and up, is the operational target.
**A3** — One GPS sample per second per device is the real cadence (confirmed
against data during the V2 work).
**A4** — Existing tracking/cycle-time/underspeed/pit-duration *calculations* are
correct and are not re-derived by V3.

---

## 18. What should explicitly NOT be built

- **A summary dashboard.** `Dashboard.jsx` is an empty 12-line stub. Leave it.
- **A general GIS authoring suite.** No arcade expressions, joins, spatial
  analysis toolbox, or arbitrary layer-type switching.
- **A second playback engine.** Underspeed and Durasi In Pit use the Cycle Time
  runtime or they do not get playback.
- **A second map implementation.** One `MapWorkspace`.
- **`HeatmapLayer`.** Unquantified. `ScreenGridLayer` gives counts.
- **Machine learning for polygon suggestion.** A deterministic five-step geometry
  pipeline (§9.3) is more accurate, faster, explainable, and uses functions
  already installed.
- **Auto-saved generated polygons.** Always a reviewable candidate.
- **A theoretical design system.** Components are derived from §6–§9 workflows.
- **A dark theme.** Light-first, single theme. A second theme doubles the
  contrast-verification surface for zero operational benefit.
- **Mobile-first layout.** Desktop GIS usability is not compromised for phones.
- **KPI card rows.** Named explicitly because they are the default failure mode
  for every page in §6–§9.
- **Rewriting `DatalogRecord.jsx`.** Audit and align, do not rebuild 1623 lines
  that work.
- **Touching V1, V2, or MIR** before V3 reaches parity.
- **Migrating to TypeScript or Next.js as part of V3.** Zero runtime effect;
  would delay every fix that has one. (`CYCLETIME_STACK_AUDIT_V3.md` §4.)

---

## Build status

Routes live under `/Monitoring/v3/*` (Vite `base` is `/Monitoring/`). V3 mounts
outside the legacy `<Layout>`; nothing in V1, V2 or MIR was modified.

| Route | State |
|---|---|
| `/v3/historis/cycle-time` | Built — dot trace, temporal brush, lasso, focused playback |
| `/v3/historis/underspeed` | Built — same engine, speed-band colouring + band editor |
| `/v3/historis/durasi-in-pit` | Built — worker dwell scan, occupancy timeline, event table |
| `/v3/operasi/live` | Built — MQTT roster on the shared MapWorkspace |
| `/v3/peta/area` | Built — full GIS draw/edit/measure, attributes, trace-derived polygon suggestion |
| `/v3/historis/datalog` | Placeholder (Phase F.5 — audit/align only, table not rewritten) |
| `/v3/peta/layer` | Placeholder (ortho version selector already live in the Layer panel) |

### Business analytics — correction to §1.5

The audit understated a gap. `PlaybackV2Summary`
(`Models/PlaybackV2Models.cs`) carries only `totalRitase`, `averageSpeed` and
`pointCount`. Every richer metric — loaded/empty distance and duration,
front→disposal distance, average cycle time — is computed **only** by
`TrackingHistoryController.CalculateTrailAnalytics`, which serves one unit at a
time. On the PlaybackV2 path `toLegacySummary` fills them with zeros, so V1/V2's
Summary Analytics card shows 0 for cycle time and both jarak figures whenever
PlaybackV2 is enabled. `VHMSOverlay.jsx` and `TopVHMSDisplay.jsx` are worse: both
render a hardcoded object literal, so their numbers never reflect loaded data at
all.

V3 recomputes the full set in `workers/analytics.worker.js`, a **faithful port**
of the C# — each function names the method it mirrors, and the plm_status
taxonomy comes from `cycleTimeStore.js`. It additionally derives per-cycle
detail and run-length state segments, which the backend computes but discards.

Surfaces: `FleetSummaryPanel` (time allocation + production + cycle + haul),
`UnitMetricsTable` (ranked, sortable, in-cell bars), `StateTimeline` (plm_status
occupancy as the second temporal mode), `PlaybackInspector` (real VHMS values at
the playhead).

Files: `frontend-v1/src/v3/`. Foundation (`foundation/`, `state/`, `services/`,
`workers/`), map platform (`map/`), shell (`app/`), panels (`panel/`), temporal
(`temporal/`), pages (`pages/`).

Bundle after `manualChunks`: app 1.12 MB (was 3.93 MB single file); deck.gl,
MUI, maplibre and Arrow now cache independently of application deploys.

**Verified**: production build compiles; the V3 shell renders (rail, context bar,
map workspace, toolbar, panels, temporal strip) against a running dev server.

**Now verified end to end** (2026-08-17): the query → chunk → decode → trace path
runs against live ClickHouse data — 137 units over 2 hours renders 871,086
samples with the fleet summary populated. Getting there took four defects, all
of which had been invisible because no data had ever reached the renderer. See
§19.

---

## Decision summary

| # | Decision | Because |
|---|---|---|
| 1 | Dot trace is the default historical view; playback is opt-in | The spatial answer is instant and is currently never shown (P3) |
| 2 | `ScatterplotLayer` + binary attributes + `DataFilterExtension` | Only candidate giving per-point colour, GPU time filtering and picking (§6.2) |
| 3 | Delete the worker's POJO loop; transfer typed arrays | The columnar form already exists one line earlier (§1.2) |
| 4 | Timeline is a density histogram with a brush, not a seek bar | Answers "when was activity dense" (P4) |
| 5 | Filters live in a persistent context bar | The map stops being hidden behind a modal (P2) |
| 6 | One `MapWorkspace`; pages compose layer factories | Removes three near-duplicate map integrations (P8) |
| 7 | Typed arrays in a plain module, never in Zustand | Store `set()` walks all subscribers; buffer identity must stay stable (§12) |
| 8 | Underspeed and Pit reuse the Cycle Time engine entirely | One engine, one playback runtime, two semantic bindings |
| 9 | Buffered trajectory union for polygon suggestion | Explainable parameters; alpha shape's α is not (§9.3) |
| 10 | Promote `mirTokens.js` rather than design a new palette | A validated colourblind-safe light system already exists (§1.8) |
| 11 | 3 M sample budget with visible stride reporting | Bounded GPU cost without silently hiding data (§13) |
| 12 | V3 is additive under `/v3/*`; nothing existing is modified | V1/V2/MIR stay shippable throughout |

---

## 19. Session 2026-08-17 — first live data, and the redesign brief

### 19.1 The trace path was broken in four places at once

None of these were visible before, because a decode failure upstream meant no
sample had ever reached the renderer. Each was found only after the one before
it was fixed.

1. **ClickHouse compressed the Arrow batches.** `output_format_arrow_compression_method`
   defaults to LZ4; `apache-arrow` (JS) ships no codecs and failed every chunk
   with "Record batch is compressed but codec not found". All 274 chunks were
   discarded and the only ones that advanced the counter were the two `204`s —
   which is exactly why it looked like a slow load rather than a total failure.
   Fix: emit uncompressed and let HTTP `content-encoding` carry the size win
   (259 KB → 80 KB with brotli, better than the LZ4 it replaced). The Arrow MIME
   type had to be added to `ResponseCompression` for that to apply.

2. **`pooled()` swallowed the failures.** One `catch` with no counter turned a
   systemic fault into "still loading". It now counts, logs the first error, and
   surfaces "N dari M chunk gagal".

3. **Epoch was 8 hours off.** `wita_time` holds WITA wall clock and the server
   runs UTC, so `toUnixTimestamp64Milli` returned the wall clock read as UTC.
   Every V3 formatter renders WITA as `new Date(ms + 8h).getUTCHours()`, i.e. it
   expects a true instant, and the GPU time filter compares against a range
   parsed from `...+08:00`. Every sample fell outside the filter and the trace
   drew nothing. Fixed server-side (`PlaybackV3Service.EpochMs`); hour KEYS stay
   wall clock, because those are matched against `wita_time` in SQL.

4. **The camera framed empty sea.** `fitToData` used absolute min/max, and 0.21%
   of samples from 3 units sat up to 2000 km away. Zoom bottomed out at its
   floor and centred between the mine and the outliers, where the ortho has no
   tiles — a white screen. Now trims to the 1st–99th percentile, and hands the
   box to `WebMercatorViewport.fitBounds` instead of a `log2(360/span)` estimate
   that ignored canvas size and sat ~3 zoom levels too far out.

### 19.2 Architecture changes that followed

**Chunks are per hour, not per device-hour.** 137 units × 2 hours meant 274 HTTP
round trips and 548 ClickHouse queries (each chunk also ran a count probe) to
answer what is one scan of one partition. ClickHouse answers the batched form
for the whole fleet in ~0.6 s. Devices are identified by `device_index` — their
position in the session's ordered device list — which drops the repeated
deviceid/unitno strings (59 MB → 23 MB per hour) and makes segmentation an
integer compare. Context rows were dropped: the decoder had always discarded
them, so fetching them was pure cost, and removing them also removed the
three-way UNION.

**The decoder stopped using Arrow accessors.** `vector.get(i)` costs ~2.3 µs/row
through dispatch and null handling: 1992 ms for 871k rows. Reading the same data
as raw typed arrays per record batch costs 1 ms. Nullable columns are read
through their validity bitmap — `plm_status` is null on 206k of 436k rows, and
raw `values[i]` would report every one of those as `0`, corrupting ritase.

**One deck.gl layer per hour, not per device-hour.** 274 `ScatterplotLayer`s lost
the WebGL context outright (blank canvas; `isContextLost()` true at 137 units,
false at 8). A 12-hour shift would have been 1644. The decoder now writes one
buffer set per hour and the registry hands out per-device **subarray views** into
it, so every analytics/playback/panel consumer is unchanged and recolouring
still mutates what the GPU already holds. Two things had to move into the data:
dimming is written to the alpha channel (`registry.setDimmed`), and picking maps
a sample index back to its device by binary search over the range table.

**Stride moved server-side.** A 12-hour shift over 137 units exceeds the sample
budget ~2×, and striding after transfer meant downloading ~276 MB to discard
half. `toUnixTimestamp(wita_time) % N = 0` thins each device evenly without a
window function and keeps the same instants across devices.

### 19.3 Product decisions taken with the user

- V3 gets its **own** geofence/layer/polygon management. It is not wired to the
  `jiep-digi-mh02-geofence-mangement` service, whose model (Layer → Polygon with
  category, `MaxSpeedEmpty`/`MaxSpeedFull`, restricted/high-risk, `IsClosed=false`
  meaning an open *segment*) is treated as a proven reference for which
  properties matter, not as a backend.
- **Loader reassignment is shown, not filtered.** A DT can change loader
  mid-range; the full trace is kept and the move is surfaced so the operator
  recognises it.
- Shift preset is **06:00–18:00 / 18:00–06:00**, even though MiForce's own SQL
  marks DAY as 05:59:59–19:00:00 and Timesheet uses T04/T05.
- Fleet assignment source (MiForce vs Timesheet) is **chosen per query**.

### 19.4 New surfaces

| Surface | State |
|---|---|
| `HistoryContextV3Controller` | Availability as a per-hour count, not a boolean; loader assignment per hour. Also fixes a latent bug in `multi-haulers` mode, which compares `WitaHour` to the range's start/end hour independently of the date and so mismatches any multi-day range. |
| `ExportV3Service` / `ExportV3Controller` | Export as a job (create → poll → download). Streaming path for CSV/Parquet in lon/lat (ClickHouse writes the file); row-wise path for XLSX and UTM. UTM via ProjNet, not hand-written SQL trigonometry. No new dependencies. |
| `GeofenceV3Service` + `tbl_m_v3_geofence_{layer,feature}` | V3's own areas. One table for both shapes: a closed ring is an AREA, an open path is a SEGMENT (`geometry_type`). DDL is idempotent and runs on first use — this project has no EF migration pipeline. Controller and `areaStore` wiring still pending. |
| Design foundation | Tailwind v4 **without preflight**, scoped to `.v3` so the legacy MUI app in the same bundle is untouched. `@theme static` is required or the tokens are tree-shaken away. Tailwind supplies the token layer only — components style themselves with inline objects from `tokens.js`, not utility classes; see §20.2. Type scale gained a real top end (it stopped at 16px, which is why hierarchy read flat) and a tabular metric tier. One focus ring for everything — every control previously had `outline: none` with no replacement. |
| Loading system | Four patterns by what is being waited on: `Skeleton`, `ProgressBar`, `BusyOverlay` (refresh in place; the map is never blanked), `StatusNote` (empty / no-data-in-range / error+retry, which were one grey message before). |

### 19.5 Incidental fixes

- `Program.cs` registered the whole V3 block **twice**. The redundancy was
  harmless; the second `AddHostedService` pointing at the same
  `ClickHouseIngestWorker` singleton was not — the host called `StartAsync` on
  one instance twice. Masked only because ingest is off in dev.
- Raw-SQL projections now use ADO.NET rather than `Database.SqlQueryRaw<T>`:
  EF only promises `SqlQuery` for scalars and mapped types.
- Ortho now draws a **site footprint** under the imagery as soon as the extent is
  known, and the map opens on that extent instead of a hardcoded lon/lat. A site
  whose tiles have not arrived is otherwise indistinguishable from a broken page.

### 19.6 Environment trap worth knowing

`dev.sh` symlinks `frontend-v1/node_modules` to ext4 for WSL speed. `npm install`
run through that symlink replaces it with a real directory on `/mnt/d`; the next
`dev.sh` moves that aside to `node_modules.bak-*` and re-links to the **stale**
native tree, so the newly added dependency vanishes. It cost two cycles here.
Install into `~/native-node-modules/frontend-v1-project` directly. `dev.sh` also
decides whether to install by testing for `node_modules/.bin/vite`, which a stale
tree always passes.

### 19.7 Still open

- Map **picking** is wired correctly but unverified: the dots are 1–3 px and test
  clicks missed. Dimming, render, epoch and layer count are all verified.
- Workspace composition (map vs panel proportion, skeletons in metric panels),
  Cycle Time temporal rework, Underspeed speed classes, Durasi In Pit, Datalog
  polish, and the geofence controller + `areaStore` wiring.

---

## 20. Session 2026-08-18 — brief items that were never answered in writing

An audit against the original brief found three items that the build had passed
over silently. Two were decisions taken without being recorded, which is the same
as not having taken them: the next person cannot tell a judgement from an
oversight.

### 20.1 Mantine — evaluated, declined

The brief asked to *consider whether Mantine is a good primary UI primitive based
on the existing codebase, rather than blindly keeping or replacing the current
stack*. `foundation/ui.jsx` was hand-rolled instead and no rationale was written
down. The evaluation, made explicit:

**Declined as the primary primitive.** The deciding constraint is the shared
bundle. V3 lives alongside ~24k lines of MUI (V1/V2/MIR); Tailwind's preflight
was deliberately excluded and the base layer scoped to `.v3` precisely to keep a
global reset away from those pages. `@mantine/core/styles.css` reintroduces that
same class of risk as a third styling system in one bundle, and the payoff is
small: `ui.jsx` already covers the 17 primitives V3 uses, and the only genuine
capability gap was a date-range picker.

The performance argument in `ui.jsx:4-7` — Emotion re-serialising CSS on every
render during map interaction — is **not** part of this rationale. Mantine v7
dropped Emotion for static CSS, so that objection applies to MUI, not to Mantine.
The reasons to decline are bundle-level CSS risk and migration cost against one
missing component.

**Revisit if** V3 is ever split into its own bundle, or if the primitive set
grows past roughly a Combobox and a data grid — hand-rolling either of those is
where the balance tips.

### 20.2 The design foundation is tokens, not Tailwind utilities

§19.4 described the foundation as "Tailwind v4", which does not match the code:
V3 contains **398** inline `style={{…}}` objects and **zero** Tailwind utility
classes. The twelve `className` uses are all bespoke (`tnum`, `skeleton`,
`bar-indeterminate`, `v3`).

What is actually true, and is the intended arrangement: Tailwind supplies the
`@theme static` token layer as CSS variables, `tokens.js` mirrors those same
values for JS, and components style themselves with static inline objects. That
mirroring is not redundancy — deck.gl colour accessors and canvas drawing cannot
read a CSS class, so the tokens have to exist in both forms.

Converting 398 inline objects to utility classes is churn with no user-visible
result and is explicitly **not** planned. The document was wrong, not the code.

### 20.3 Time range picker — the Metabase pattern the brief asked for

The brief named Metabase twice: once as general inspiration and once
specifically for the *compact analytical filter experience*. The word appeared
nowhere in the plan or the code. `TimeRangePicker` was a flat shortcut list plus
two `datetime-local` fields.

Rebuilt on Metabase's actual model — a segmented **Pintasan / Relatif / Kustom**
switch — adapted rather than copied:

- **Pintasan** carries mine shifts, not calendar ranges, and shows which preset
  is currently in effect. The active state is held as the *chosen key*, not
  derived by comparing dates: a relative range stops equalling its own shortcut
  a minute after it is picked, so a derived state would switch itself off.
- **Relatif** is an N-plus-unit builder (`6 jam terakhir`), the part of Metabase
  operators reach for most.
- **Kustom** keeps the native fields and adds a **day stepper**. Comparing one
  shift against the same shift yesterday is the repeated task, and it previously
  meant retyping both bounds.
- The resolved window is spelled out at the bottom in every mode. A preset is
  only trustworthy if what it resolved to is visible without leaving the popover.

No calendar grid was drawn. `datetime-local` already opens the platform's own
calendar, and operators pick shifts and offsets far more often than arbitrary
dates — a hand-built grid would be several hundred lines duplicating a native
control.

**A real bug fell out of this.** The old shift 2 preset built *today 18:00 →
tomorrow 06:00*. An operator opening the page at 08:00 — the normal time to
review the night that just ended — got an entirely future window and an empty
map. Both presets now resolve to the most recent shift that has already
*started*.

The date arithmetic moved to `app/timeRange.js` so it can be asserted without a
DOM or a test framework; `app/timeRange.test.mjs` runs under plain `node` and
covers the shift boundaries, including the invariant that a preset never starts
in the future.

---

## 21. Session 2026-08-18 — Mantine, workspace composition, and the loader filter

A long session driven by the redesign brief. Three decisions here reverse or
correct something written earlier; those are marked, because a reversal that is
not recorded reads as an inconsistency to whoever finds it next.

### 21.1 Mantine adopted — §20.1 reversed

§20.1 declined Mantine as the primary primitive. The user then instructed it
directly, so it is in. The earlier rationale is not deleted: it was a reasonable
read of the trade-off, and the constraint it worried about turned out to be real
but manageable.

**`foundation/ui.jsx` became an adapter, not a re-export.** Twenty components
already imported those names with those prop shapes — `variant="primary"`,
`tone="crit"`, `onChange(boolean)` — so the contracts stayed and Mantine went
behind them. The swap touched one file instead of twenty. `mantineTheme.js` maps
the existing tokens onto Mantine, so this is a change of machinery, not of
design language.

Two Mantine defaults are overridden throughout: shadows (this product separates
surfaces with borders) and uppercase pill badges (the brief rules those out).

**The three pickers had to be rewritten anyway.** Mantine's Popover is
composition-based (`Popover.Target` / `Popover.Dropdown`), not `anchorRef`-driven.
Wrapping that back into an imperative shape would have reintroduced the manual
positioning the swap removes.

`Button` had to become `forwardRef`. `Popover.Target` clones its child and hands
it a ref to anchor against; a plain function component swallows it and the
dropdown anchors to the wrong element, with only a console warning.

### 21.2 `cssVariablesSelector` must be `:root`, not `.v3`

Scoping Mantine's CSS variables to `.v3` looked like the safe containment choice
and was a bug. Every popover, dropdown and modal renders through a portal into
`document.body`, which is **outside** that subtree, so `--mantine-*` did not
resolve there and portalled content fell back to unset values — a checked
checkbox drew white on white.

`:root` is safe because the variables are namespaced; legacy MUI reads none of
them. The containment that actually matters is `withGlobalClasses={false}` and
`withStaticClasses={false}`, which keep unscoped selectors out of a bundle shared
with ~24k lines of MUI.

Also worth knowing: **Mantine's stylesheet is unlayered**, and unlayered CSS beats
every `@layer` rule regardless of specificity or import order. theme.css lives in
`@layer base`, so Mantine wins any overlap no matter how the imports are ordered.
A conflict there cannot be fixed by moving import lines.

### 21.3 MiForce is not filtered by region — V1 parity restored

The loader filter came back empty for every range. Cause: §19.4's units endpoint
had gained `AND LTRIM(RTRIM(a.REGION)) = @Distrik` on the MiForce query.

**V1/V2 does not have that predicate.** It selects `REGION` and scopes by district
afterwards, through the S3 availability join. If `HIS_SETTING_FLEET.REGION` does
not hold exactly the district code, that one line is the difference between every
row and none — and `source` defaults to `miforce`.

Removing it alone would leak other districts' haulers, because §20-era work made
the unit universe the device master **union** the assignment haulers. So scoping
moved to where V1 does it: `NarrowToDistrict` keeps a hauler when there is
evidence it belongs here — present in this district's device master, or carrying
availability rows against this district. Timesheet keeps its `dstrctcode`
predicate; V1 has that one.

**The failure was invisible, which was the worse half of the bug.**
`LoadAssignmentsAsync` caught every exception and returned an empty dictionary, so
a broken query and an idle shift looked identical. The response now carries
`assignmentError` (query threw) and `assignmentNote` (ran clean, empty, reason
knowable), and the picker distinguishes four states — not loaded, loading, failed,
genuinely empty. The "not loaded" case matters: when district is still blank the
hook returns early without setting `loading`, which used to render as "no loader
data" before anything had been asked for.

### 21.4 Hours only — no minutes in the range

Availability is one row per unit per WITA hour, and both fleet sources report by
hour (`DATEPART(HOUR, CREATED_AT)`, `ProduksiDetilJam`). V1 never offered minutes.

Allowing them bought nothing and cost correctness: 06:30–18:30 produced an hour
window of 6..18 for the assignment query while the availability denominator
counted a different set of slots. `toInput` now always emits `:00`; `apply()`
floors the start and **ceils** the end, so the hour in progress is included.

A trap that came with it: `endOfDay` was 23:59, which was harmless while minutes
existed and would have silently dropped the last hour of every "hari ini" query
once they did not. It is now the next midnight, so a day is 24 slots. Asserted in
`timeRange.test.mjs`.

The assignment queries also gained the hour window V1 has, including the wrap
branch for night shifts (18..05, where a plain `BETWEEN` matches nothing). V1
declares `@StartHour`/`@EndHour` for its timesheet query and never uses them; that
gap was not carried forward.

### 21.5 Loader is a filter, and it selects

Loader existed only as a "group by" checkbox inside the unit picker, which made it
a way of *arranging* the DT list rather than something to filter on — even though
"what did LDR-07 haul this shift" is how work is assigned and reviewed.

- It is now its own control in the context bar, reading the server's `loaders`
  index rather than re-deriving from the unit rows. Two paths to the same number
  is how they drift; the client-side `summariseLoaders` was deleted.
- **Choosing a loader selects its DTs.** An earlier version only narrowed, on the
  reasoning that a loader with twelve DTs is a question rather than an answer. The
  user corrected that: work is assigned by loader, so making someone tick twelve
  boxes repeats what they just said. Dropping a loader removes only the DTs it
  brought — a DT shared with a still-selected loader survives.
- The **MiForce / Timesheet switch moved here** from the unit picker. It decides
  the loader→DT mapping, so having it behind the DT control meant two places to
  look for one question.
- Both multi-select popovers now share one shape: search, count, Kosongkan,
  Pilih *n*, bounded scroll column. Select-all operates on the search result and
  names its own number, so it never reaches past the filter silently.

### 21.6 Workspace composition

- **Navigation** is 232px and labelled. Nine destinations in three named groups is
  an application menu, and one that must be hovered to be read is a menu the
  product is apologising for. The icon rail survives as a collapsed state. It is
  light now: a dark slab against a white workspace was the strongest visual
  statement in the app, spent on chrome.
- **The contextual panel is permanent.** It used to be closable to nothing, which
  left a full-bleed map with no second surface — the emptiness the brief was
  written about. It also follows the selection: selecting units shows their
  metrics, clearing goes back to the fleet summary.
- **Panel width follows the imagery** (`map/orthoFit.js`). The map used to take
  every pixel the panel did not claim, so a site whose ortho is taller than it is
  wide sat in a wide canvas with empty basemap either side — width spent on
  nothing while the summary stayed at its minimum. Width is now derived from the
  ortho's Mercator aspect against the row height, remainder to the panel, bounded
  352–560. Below 872px total the two minima cannot both hold and **the panel
  wins**: its tables have fixed columns and clip, the map only becomes a smaller
  viewport. That tiebreak is asserted rather than left to clamp ordering.
- **Ortho re-fits on resize.** Framing was computed once, so every later layout
  change — panel opening, nav collapsing, dock growing, browser resize — left the
  site framed for a canvas that no longer existed. That is what produced the wide
  empty margins. A `ResizeObserver` reproduces the remembered fit; padding is
  asymmetric for the toolbar and legend; and a manual pan or zoom **cancels** the
  framing intent so the view is never yanked back.
- The type scale floor moved up a step — 12px is now the smallest thing rendered.
  The product read as instrumentation because every filter label, panel overline
  and table header sat at 11px uppercase. Inter is named first in the stack, not
  bundled, so nothing depends on a fetch.
- The temporal strip's mode switcher was floating over the chart at a hardcoded
  `top: 5, left: 148` in 18px buttons; it is now a titled dock header, which is
  also where the map's zoom/coordinate readout went so it stops covering the site.

### 21.7 New surfaces

| Surface | State |
|---|---|
| `GeofenceV3Controller` | The service was complete and simply never wired. District appears nowhere in the API surface — not a route value, not a query parameter — because a district the caller can name is one the caller can change. |
| `pages/LayerOrthoV3` | Imagery and vector layers, deliberately in separate sections: an orthophoto is uploaded, converted server-side over minutes and then immutable; a vector layer is drawn and given operational rules. Merging them puts an upload bar beside a speed-limit field. |
| Ortho upload | Chunked (8MB), client-driven, then `upload/complete`. **There is no conversion-status endpoint** — completion is only observable by polling `layers` for `converted`. Upload and conversion are therefore two phases, not one bar: bytes leaving the browser are measurable, conversion is not, and one bar would sit at 100% for minutes. The 20-minute timeout says "check back", never "failed", because the service gives no way to tell those apart. |
| KML import | Parsed in the browser, reviewed, then committed in one transaction. Skipped placemarks are named, not just counted. |
| `pages/DatalogRecordV3` | Polish, not redesign — the query contract is untouched. Shares ContextBar with the other historical pages. A refresh dims the existing rows rather than blanking the table, and the search box narrows the fetched page only, which it says. |

### 21.8 Environment

ClickHouse runs locally as container `ch-spike`, now `--restart unless-stopped`
(set with `docker update`, so no recreate and no data loss). Docker volumes live
on ext4 at `/var/lib/docker`, **not** on `/mnt/d` — the near-full D: drive is
irrelevant to it.

Sizing, from the PVC comment in `aws_conf/Deployment.yaml`: ~2.4 GB/day, 90-day
TTL, 300Gi claim. A 7-day TTL would use ~17 GB, but `MaxRangeDays` is 31 and the
PVC cannot shrink — so shortening it loses history without recovering cost, and
lets operators ask for ranges that silently return nothing. **Raise or lower the
TTL and `MaxRangeDays` together, never separately.** The unbounded thing is
ClickHouse's own `*_log` system tables, which have no TTL.

### 21.9 Two silent export bugs, found by reading `system.query_log`

Both were in the code already; neither was caused by the test data. They are
recorded because each was invisible from the outside and each cost a long
detour.

**The range ran an hour late.** `ExportV3Service.ParseRange` handed a naive
datetime to `DateTimeOffset.TryParse`, which stamps it with the *machine's*
offset, then converted that to +08:00. The Dockerfile sets the container to
`Asia/Jakarta` — which is WIB, **UTC+7** — so every export queried one hour
later than the operator asked for. `wita_time` stores wall clock, not an
instant, so no conversion should happen at all. `HistoryContextV3Controller`
already had the correct rule in `TryParseWita`; export simply never used it.

The failure mode is what made it expensive: when the neighbouring hour happened
to hold data, a file came out — with the wrong hour in it.

**Projection aliases shadowed the source columns.** The export columns alias
their expressions back to the column name (`formatDateTime(wita_time, …) AS
wita_time`). In a flat SELECT, ClickHouse resolves `wita_time` in WHERE and
ORDER BY to that String alias, and comparing it to a DateTime fails with
NO_COMMON_TYPE. Filtering now happens one level down, in a subquery.

This one only surfaced *after* the range fix, because the count probe has no
projection to shadow anything — the query never got far enough to fail.

Worth internalising: **the same alias trap bit an ad-hoc `INSERT … SELECT`
during this session**, where `AS wita_time` made the WHERE evaluate against the
already-shifted value and inserted zero rows with no error. Whenever an alias in
ClickHouse reuses a source column's name, assume every other clause now sees the
alias.

**How it was actually diagnosed.** Three plausible hypotheses were wrong —
deviceid drift (265 of 272 matched), assigned units lacking telemetry (122 of
129 overlapped), and the sampling modulo (175k rows). What settled it was
ClickHouse's own `system.query_log`, which stores the exact SQL the application
sent, parsed dates and all. Reach for it early.

### 21.10 Still open

- Nothing in §21.7 has been rendered yet, and the Mantine swap is unverified. The
  highest-value check is opening a legacy V1/V2/MIR page after a build: whether
  Mantine's stylesheet leaks into the shared bundle is the one risk that could not
  be settled by reading.
- Whether the loader filter is actually fixed. If it is still empty, the new
  `assignmentError` / `assignmentNote` distinguish "nothing from the source" from
  "filtered out by district narrowing".
- `datalog_spike` (202 MiB) is a leftover duplicate of `datalog`; system log TTLs
  are unset. Both flagged to the user, neither actioned.
