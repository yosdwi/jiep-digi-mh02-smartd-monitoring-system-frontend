# Geofence Management Mockup Progress

Tanggal: 2026-06-20

## Tujuan

Membuat tab baru **Geofence** di MIR sebagai mockup **Geofence Management**, bukan lagi sekadar mode teknis "Ubah geofence".

Fokus user view:
- User pertama perlu melihat master list disposal.
- Dari tiap disposal, user perlu tahu jumlah **Gate** dan **Cabin**.
- Setelah itu user bisa drill down ke Gate untuk melihat rover pembentuk MIR dumping polygon.
- Assignment cabin ke disposal akan menjadi sumber logic deteksi: cabin yang assigned ke disposal tertentu hanya aktif/valid untuk disposal itu.

## Update 2026-06-21 — Rework penyajian jadi management table + drill

Fokus sesi ini: penyajian UI/UX untuk **user bisnis** (gaya management table/Kendo), bukan data wiring.

Perubahan di `frontend-v1/src/pages/MIRGeofence.jsx`:

- **Tab datar → breadcrumb drill**. Bottom panel sekarang berjenjang:
  `Master Geofence › Disposal A01 › Gate 2` (tiap crumb bisa diklik untuk naik).
  State `activeTab` diganti `level` (`master`/`disposal`/`gate`) + `selectedGateId`.
- **Level Master**: `AreaTable` digrid-kan gaya Kendo — kolom `Disposal | Kategori | Gate | Cabin | Status` (chip Live/Draft). Klik baris/polygon → masuk level disposal. Toggle `Disposal / Deployment` (DeploymentTable jadi sub-view, bukan tab terpisah).
- **Level Disposal**: `GateTable` (kolom `Gate | Status | Rover | Ambang | Dumping area | ⚙`) + **CabinTable tampil bersama** dalam konteks disposal. Klik ⚙ → level gate.
- **Level Gate**: `GateSettings` (baru) — ringkasan Rover 0 / Ambang / jumlah rover + rover table (Rover | Peran | Posisi). Mengarah ke pola "Ubah Geofence" (`MirEditPanel` + `saveRover0`) untuk geser Rover 0 di peta.
- **Cabin list = READ-ONLY**. Assignment cabin→disposal adalah **master data dari backend** (mapping sudah jadi), BUKAN assign manual satu-per-satu. Dropdown/tombol assign dibuang. Header: `Cabin assigned · n · x online · y offline` + label "mapping dari backend".
- **Helper grid** `GridHead`/`SectionLabel`/`Empty` dipakai semua table → konsisten look Kendo (header tegas, baris padat, status sebagai chip).
- **Segmen "Teknis"** di map overlay dirapikan: sebelumnya inert, sekarang benar-benar buka/tutup `TechnicalDrawer`.
- **FALLBACK_AREAS**: gate dummy dev kini punya geometri lengkap (rover_0, ambang) supaya tabel & settingan konsisten walau deployment API tak terjangkau.
- **Fix cabin kosong saat live**: deployment live punya grup (`Polygon_24` dst) yg beda dari grup dummy `CABINS` (A/B). Ditambah effect remap dummy cabin ke grup disposal yang benar-benar ada (on `deploymentAreas`).

Catatan: dummy "2 gate per disposal" **sengaja dipertahankan** (sudah benar untuk mockup).

### Revisi lanjutan (sesi sama)

- **`DataTable` (pondasi lib-ready)** ditambahkan — komponen tabel tipis dengan definisi kolom `{ key, label, width, align, render(row) }`. Semua tabel (AreaTable/GateTable/CabinTable/rover list di GateSettings) dimigrasi ke sini. `GridHead` lama dihapus. Tujuan: nanti tinggal pasang **TanStack Table** (headless, gratis, nyatu styling) di balik `DataTable` untuk filter/sort tanpa sentuh tiap layar. Keputusan: **tunda library** sampai data real & kebutuhan filter nyata; condong ke TanStack, bukan Kendo (berlisensi + bawa styling sendiri).
- **Buang kolom status/liveness** (ini management, bukan monitoring): hilangkan `Kategori` & `Status (Live/Draft)` di Master, hilangkan hitungan `online/offline` di mana-mana (tabel cabin, header, kartu "Area terpilih"). Gate "Status" diganti kolom `Aktif` (Ya/Tidak) sebagai config-state. CabinTable read-only tinggal `Unit/ID | Plan`.
- **Buang view Deployment** (toggle + `DeploymentTable` dihapus); level master langsung tabel disposal.
- **Proporsi layout 40/60**: map jadi `flex: 0 0 40%`, panel manajemen bawah mengisi sisanya (~60%). Offset `TechnicalDrawer` disesuaikan (`bottom: 14`).

### Revisi 2 — Admin console (opsi B), satu tabel per entitas

Diputuskan halaman ini jadi **admin penuh (opsi B)**: kelola Disposal & Gate sebagai master + lihat Assignment. Breadcrumb drill + side-by-side dibuang.

- **Panel bawah = 3 section via segment**: `Master Disposal · Master Gate · Assignment`. Map atas 40%, panel 60%.
- **Master Disposal** (`DisposalAdminTable`): Disposal | Grup | Gate | Cabin | aksi (✎ rename inline, 🗑 hapus) + tombol `+ Disposal`.
- **Master Gate** (`GateAdminTable`, flat lintas disposal): Gate | Disposal | Aktif | Rover | Rover 0 | Dumping area | aksi (⚙ settingan, 🗑 hapus) + `+ Gate di <disposal terpilih>`. Klik chip Aktif = toggle. ⚙ → `GateSettingsDrawer` (Rover 0 + rover list) overlay di peta.
- **Assignment** (`AssignmentTable`, READ-ONLY): Cabin | Disposal | Gate | Plan + filter disposal.
- **`areas` jadi state** + handler CRUD mockup lokal (add/rename/delete disposal; add/delete/toggle gate). Disposal baru dapat polygon kotak default di center peta + gate dummy.
- **Catatan gap**: Disposal asalnya GeofenceManagement, Gate dari geofence-core → CRUD di sini **mockup lokal**, wiring backend menyusul. Assignment tetap read-only (master mapping backend).

### Next (lanjut besok)
- Settingan Rover 0 di level gate masih read-only → wujudkan interaksi geser di peta (pola Ubah Geofence) bila diperlukan.
- Ganti sumber `cabins` (dummy `CABINS` + effect remap) dengan fetch master mapping cabin→disposal dari backend saat endpoint siap.
- Opsi: poles sortable kolom beneran + sticky header per-tabel.

## Update 2026-06-22 — Pivot: Master Disposal CRUD (gaya Google My Maps)

Ganti arah total. Halaman ini bukan lagi admin console drill (disposal→gate→cabin),
tapi **manajemen master disposal** murni: user CRUD disposal, edit polygon di peta,
dan import/export KML — layaknya fitur Google My Maps.

Keputusan teknis (dikonfirmasi user):
- **Tabel = TanStack Table** (`@tanstack/react-table`), bukan Kendo (berlisensi). Headless +
  styling token MIR sendiri. Fitur: sort kolom, global search, filter district, pagination (8/hal).
- **Edit polygon = nebula.gl** via `@deck.gl-community/editable-layers` (`EditableGeoJsonLayer`)
  — kompatibel deck.gl v9 (nebula.gl asli peer-dep deck.gl v8). Mode: Draw / Modify / Translate / View.
- **Import/Export KML = fungsional client-side** (`src/utils/kml.js`, DOMParser + Blob download).
  Export polygon disposal → `.kml`; import `.kml` → disposal baru. ExtendedData simpan district/isActive/createdBy.

Susunan kolom tabel (sesuai permintaan):
`DISPOSAL (PK) · POLYGON · DISTRICT · CREATED DATE · CREATED BY · MODIFIED DATE · MODIFIED BY · IS ACTIVE` + aksi.

Struktur layout: **peta atas 42%** (lihat + edit polygon, form drawer di kanan) + **tabel CRUD bawah**.
Toolbar: search · filter district · Import KML · Export KML · + Disposal.

CRUD = state lokal mockup (seed `SEED` 9 disposal; tetap fetch active deployment GeofenceManagement
sebagai sumber real kalau terjangkau, tiap polygon → 1 disposal mewarisi metadata deployment).

Dependency baru: `@tanstack/react-table`, `@deck.gl-community/editable-layers`
(deck.gl ikut ter-bump 9.0.21 → 9.3.5).

**Catatan dep conflict**: editable-layers menarik luma.gl 9.3.x → sempat error
`luma.gl - multiple versions detected`. Fix di `vite.config.js`: `resolve.dedupe` luma/deck core +
`optimizeDeps.include` deck.gl & editable-layers (prebundle bareng, satu instance luma).
Setelah ubah, hapus `node_modules/.vite` & restart dev.

File baru: `frontend-v1/src/utils/kml.js`. `MIRGeofence.jsx` ditulis ulang penuh
(buang gate/cabin/rover/drill — fokus master disposal). Yang di bawah ini histori arah lama.

### Struktur panel: tab master (2026-06-22)

Panel bawah jadi tab navigasi: **Master Disposal · Master Gate · Master Assign**.
Master Disposal sudah jadi; Gate & Assign placeholder "segera hadir". UI lain dipoles:
search bar pro (ikon + focus ring + clear), `Is Active` jadi badge **read-only**
(ubah status hanya via form Edit — hindari toggle destruktif tak sengaja), aksi baris
jadi tombol berlabel **Edit / Hapus**, seluruh baris clickable (select + zoom polygon),
hapus pill "Deployment: …" yang noise.

### Master Gate (diimplementasi 2026-06-22)

Sudah jadi: tab **Master Gate** = tabel TanStack (`GateForm` + editor rover di peta).
Kolom: `GATE · DISPOSAL · DISTRICT · ROVER · ROVER 0 · AMBANG · DUMPING AREA · MODIFIED · IS ACTIVE · AKSI`.
CRUD lokal (`gates` state, `GATE_SEED`). Editor: geser R0/R1/R2 (EditableGeoJsonLayer Point +
ModifyMode) → `deriveGateGeometry()` regenerate dumping area/unsafe/line/warning sebagai preview real-time.
`DataGrid` digeneralisasi (dipakai disposal & gate). Legend peta tab-aware. Math di
`deriveGateGeometry` (posisi rover + ambang meter → geometri; `M_PER_DEG` aproksimasi).

Desain awal (untuk rujukan) di bawah:

### Desain Master Gate (disepakati 2026-06-22)

Master Gate = data master **Gate + Rover** untuk MIR dumping. Hierarki tetap
**Disposal → Gate → Rover**. Keputusan (dikonfirmasi user):
- **Rover nested di Gate** (Opsi A), bukan master device terpisah. Rover = peran + posisi.
- **Ambang per-gate** (bukan global): `safe / unsafe / line-tol / warning[3]`.
- **Editor = geser rover → auto-generate**: user cuma geser R0/R1/R2 + set ambang,
  geometri (`dumping_line/area/unsafe/warning1-3`) ter-generate sebagai preview
  (math dari `makeDummyDumpingGates` dibalik: posisi rover + ambang → geometri).
  Tidak ada gambar polygon bebas seperti di Disposal.

Kolom tabel: `GATE (PK) · DISPOSAL · DISTRICT · ROVER · ROVER 0 · AMBANG · DUMPING AREA · IS ACTIVE · CREATED/MODIFIED (date+by) · AKSI`.

Data model:
```js
gate = {
  id, name, disposalId, district, isActive,
  rovers: [
    { id: 'R0', role: 'anchor', position: [lon, lat] }, // orientasi safe/unsafe
    { id: 'R1', role: 'line',   position: [lon, lat] },
    { id: 'R2', role: 'line',   position: [lon, lat] },
  ],
  thresholds: { safe: 20, unsafe: 20, line: 0.1, warning: [15, 7, 5] },
  // derived (read-only): dumping_line, dumping_area, dumping_unsafe_area, warning1/2/3
  createdBy, createdDate, modifiedBy, modifiedDate,
}
```

### Master Assign (diimplementasi 2026-06-22)

Tab **Master Assign** = mapping cabin → disposal/gate. Keputusan (dikonfirmasi user):
**CRUD manual** (bukan read-only lagi), granularitas **disposal + gate opsional**,
**tanpa effective from/until** — cukup `Is Active`.
Kolom: `CABIN/UNIT · DISPOSAL · GATE (opsional/"Semua") · PLAN · IS ACTIVE · LAST MODIFIED · MODIFIED BY · AKSI`.
`AssignForm` (drawer, tanpa editor peta) — pilih unit (datalist `UNIT_SEED`), disposal, gate
(opsi ikut disposal terpilih), plan, status. Pilih baris/disposal → peta highlight disposal+gate target.
State `assignments` + `ASSIGN_SEED` (CRUD lokal); regenerate saat deployment live di-load.
Toggle layer Cabin masih disabled (assignment tak menggambar titik cabin; belum ada posisi live).

Ketiga master (Disposal · Gate · Assign) kini fungsional. Cabin sebagai titik di peta menyusul
kalau ada sumber posisi live.

## File Yang Dibuat/Diubah

- `frontend-v1/src/pages/MIRGeofence.jsx`
  - Halaman mockup Geofence Management.
  - Fetch active deployment GeofenceManagement.
  - Render polygon disposal, dummy gate, dumping area, unsafe area, line, warning line, dan rover points.

- `frontend-v1/src/App.jsx`
  - Tambah route `/mir/geofence`.

- `frontend-v1/src/components/mir/operasi/MirTabBar.jsx`
  - Tambah tab `Geofence`.

- `frontend-v1/vite.config.js`
  - Tambah dev proxy `/geofence-management` untuk menghindari CORS saat fetch dari `localhost:5173`.

## Route

Frontend route:

```text
/Monitoring/mir/geofence
```

Tab key:

```text
geofence
```

## Endpoint Data Disposal

Source utama master disposal untuk mockup sekarang dari active deployment GeofenceManagement.

Dev fetch lewat Vite proxy:

```text
/geofence-management/api/getcurrentactivejob?token=...
```

Proxy target:

```text
http://smartd-mh02-geofence-management.apps.pamapersada.net
```

Endpoint asli yang sudah dicek:

```text
http://smartd-mh02-geofence-management.apps.pamapersada.net/api/getcurrentactivejob?token=EgZjaHJvbWUyBggAEEUYOdIBCDMxNjJqMGo3qAIAsAIA
```

Catatan:
- Direct browser navigation ke URL tersebut berhasil `200 OK`.
- Direct `fetch()` dari Vite dev kena CORS.
- Karena itu frontend memakai proxy path `/geofence-management/...`.
- Token masih dipakai sementara untuk mockup. Untuk production, token harus dipindah ke backend proxy, jangan hardcode di browser.

## Format Payload Active Deployment

Endpoint mengembalikan array deployment aktif. Contoh shape:

```json
[
  {
    "id": 492,
    "externalId": "deploy-highrisk-restricted-1781668697115",
    "name": "HIGHRISK-RESTRICTED-20260617_115811",
    "category": "highrisk-restricted",
    "district": "BRCG",
    "active": true,
    "createdBy": "...",
    "createdAt": "2026-06-17T11:58:17.1159517",
    "modifiedBy": "...",
    "modifiedAt": "2026-06-18T11:25:04.8908892",
    "jsonData": "[{\"location\":\"Polygon_24\",\"polygon\":[[117.5967,2.1296],...],\"restricted\":\"1\",\"highrisk\":\"0\"}]"
  }
]
```

`jsonData` adalah string JSON yang perlu di-parse menjadi array polygon.

Per polygon:

```json
{
  "location": "Polygon_24",
  "polygon": [[117.596756387107, 2.1296840655068], ...],
  "segmentindex": 1,
  "alert": "Restricted",
  "restricted": "1",
  "highrisk": "0"
}
```

Koordinat sudah format `[lon, lat]`.

## Kenapa Polygon Awalnya Tidak Terlihat

Map mockup awal center di sekitar:

```text
117.28, 1.91
```

Sedangkan active deployment polygon berada sekitar:

```text
117.58 - 117.60, 2.10 - 2.17
```

Solusi yang sudah dibuat:
- `viewStateForAreas(areas)` menghitung bounds dari semua polygon.
- Setelah fetch sukses, map auto center/zoom ke bounds active deployment.
- Klik row disposal atau klik polygon akan center ke polygon disposal tersebut.

## Struktur UX Saat Ini

> Catatan: bagian di bawah ini menggambarkan struktur **tab datar** versi awal (2026-06-20).
> Sejak 2026-06-21 sudah diganti **breadcrumb drill** + cabin read-only — lihat "Update 2026-06-21" di atas.

Tab bawah:

1. `Master Disposal`
2. `Gates & Rover`
3. `Assignment Cabin`
4. `Deployment`

### Master Disposal

Surface awal sengaja sangat sederhana sesuai POV user:

```text
Disposal | Gate | Cabin
```

Makna:
- `Disposal`: nama polygon/disposal dari active deployment.
- `Gate`: jumlah Gate dalam disposal, plus ringkasan gate aktif dan total rover.
- `Cabin`: jumlah cabin yang assigned ke disposal dan online.

Catatan:
- Cabin assignment masih mockup dummy.
- Gate/dumping data masih generated dummy dari polygon disposal.

### Gates & Rover

Klik cell `Gate` di `Master Disposal` membuka tab `Gates & Rover`.

Tabel menampilkan:

```text
Gate | Status | Jumlah | Rover
```

Rover role:
- `anchor`: rover 0, titik acuan arah safe/unsafe.
- `line`: rover 1 dan rover 2 pembentuk dumping line.

### Assignment Cabin

Masih mockup.

Konsep:
- Cabin assigned ke disposal berarti cabin itu masuk scope disposal tersebut.
- Tidak ada toggle manual deteksi on/off.
- `Unassigned` berarti cabin belum ikut disposal mana pun.

### Deployment

Menampilkan informasi source data:
- source live/fallback
- total disposal polygon
- status assignment cabin masih mockup

## Dummy MIR Gate / Dumping Generator

Karena active deployment hanya berisi polygon disposal, mockup membuat dummy gate/dumping per disposal.

Generator ada di:

```text
makeDummyDumpingGates(polygon, areaIndex, group)
```

Konsep:
- 1 disposal bisa punya 2 Gate dummy.
- 1 Gate = 1 MIR dumping polygon.
- Tiap Gate punya 3 rover:
  - `R*.0` = anchor / rover 0.
  - `R*.1` dan `R*.2` = line rover pembentuk dumping line.
- `dumping_line` hanya terdiri dari 2 titik: R1 ke R2.
- `dumping_area` dan `dumping_unsafe_area` dibuat simetris di dua sisi line.
- `dumping_line_warning1/2/3` dibuat paralel ke arah safe side.

Format dummy mengikuti konsep file:

```text
/mnt/d/Github/smartd-panoramic-webapps/mh02-mir/server/polygongenerator/MIR-DUMPING.json
```

Contoh field:

```json
{
  "dumping_area_code": "A-1",
  "dumping_area": [[lon, lat], ...],
  "dumping_line": [[lon, lat], [lon, lat]],
  "dumping_line_warning1": [[lon, lat], [lon, lat]],
  "dumping_line_warning2": [[lon, lat], [lon, lat]],
  "dumping_line_warning3": [[lon, lat], [lon, lat]],
  "dumping_unsafe_area": [[lon, lat], ...],
  "rover_0": [lon, lat],
  "dumping_safe_threshold_meters": 20
}
```

Tambahan frontend mockup:

```json
{
  "rovers": ["R0", "R1", "R2"],
  "rover_points": [
    { "id": "R0", "role": "anchor", "position": [lon, lat] },
    { "id": "R1", "role": "line", "position": [lon, lat] },
    { "id": "R2", "role": "line", "position": [lon, lat] }
  ]
}
```

## Layer Map Saat Ini

Layer yang dirender:

- Polygon disposal utama dari active deployment.
- Gate dumping unsafe area.
- Gate dumping area.
- Gate warning line 1/2/3.
- Gate dumping line.
- Gate rover points:
  - anchor/R0 warna biru.
  - line rover/R1-R2 warna hijau.
- Label rover.
- Label disposal.
- Dummy cabin points.

## Keputusan UX Penting

- Surface awal tidak menampilkan technical details.
- Surface awal hanya `Disposal`, `Gate`, `Cabin`.
- `Rover` tidak muncul di table utama, karena hierarchy user adalah:

```text
Disposal -> Gate -> Rover
```

- Detail rover muncul setelah user klik Gate.
- Tidak menggunakan modal untuk Gate detail saat ini.
- Gate detail tetap di bottom panel agar user masih melihat map dan disposal context.
- Modal nanti lebih cocok untuk aksi transactional seperti edit assignment, publish, atau advanced technical setting.

## Known Gaps

- Data Gate/Rover masih dummy generated dari polygon disposal, belum dari backend asli.
- Data Cabin assignment masih dummy, belum dari table database assignment.
- Jumlah `Cabin` pada active deployment live akan `0` sampai sumber assignment disambungkan.
- Token active job masih berada di frontend mockup. Perlu backend proxy sebelum production.
- Belum ada visual gate yang benar-benar dari geofence-core generator backend.

## Next Steps

1. Tentukan sumber data assignment cabin:
   - table DB apa
   - endpoint mana
   - shape data: cabin/unit, disposal/group, effective date, active flag

2. Tentukan sumber data Gate/Rover real:
   - apakah dari geofence-core config
   - apakah dari `MIR-DUMPING.json` generated
   - apakah perlu endpoint baru dari backend monitor/geofence management

3. Ganti dummy generator gate dengan data real:
   - `dumping_area`
   - `dumping_line`
   - `dumping_unsafe_area`
   - `rover_0`
   - rover line points

4. Buat detail panel setelah klik disposal:
   - summary disposal
   - list gates
   - assigned cabins
   - source deployment info

5. Buat interaction setelah klik gate:
   - highlight gate polygon/line/rovers di map
   - tampilkan rover detail
   - tampilkan safe/unsafe side secara jelas

6. Pindahkan token active job ke backend proxy:
   - frontend fetch relative endpoint monitor
   - backend monitor fetch GeofenceManagement active job pakai token server-side

