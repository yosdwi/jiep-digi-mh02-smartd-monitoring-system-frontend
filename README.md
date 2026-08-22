# SMARTD MH02 V3 Frontend Lab

Frontend-only workspace untuk iterasi UI/UX V3 SMARTD MH02.

## Jalankan

```bash
npm install
npm run dev
```

Buka:

```text
http://localhost:5173/Monitoring/v3/lab/fixture
```

## Mode Fixture

```bash
VITE_V3_DATA_MODE=fixture npm run dev
```

Fixture yang sudah ikut repo:

- `public/fixtures/brcb-2026-08-22-trace-2s.json`
- `public/fixtures/brcb-orthophoto-layers.json`
- `public/kml/BOUNDARY_BRCB.kml`
- `public/kml/ROADS_BRCB.kml`

Trace fixture berasal dari ClickHouse `default.datalog`, distrik `BRCB`, tanggal WITA `2026-08-22`, sampling maksimal `2 detik`, urut per unit dan timestamp. Orthophoto fixture menyimpan metadata layer dan memakai tile service remote agar repo tidak membawa ribuan tile PNG.

## Fokus Repo

Repo ini untuk development frontend V3 saja:

- map workspace
- layer manager
- panel kanan
- temporal dock
- business flow Cycle Time, Underspeed, Durasi In Pit, Area Operasi
- eksperimen Segment Builder dari dot trace

Backend monolith tetap sumber API produksi. Repo ini sengaja bisa jalan dengan fixture supaya desain dan flow bisa diedit cepat tanpa menunggu ClickHouse/backend.
"# jiep-digi-mh02-smartd-monitoring-system-frontend" 
