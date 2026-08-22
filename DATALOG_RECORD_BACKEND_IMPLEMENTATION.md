# Datalog Record — Backend & Frontend Implementation

Status: **Implemented** (backend + frontend MVP).

## Tujuan

Fitur `Playback / Datalog Record` menampilkan data **mentah (as-is)** dari S3 datalog `.gz` secara dinamis. Frontend tidak boleh hardcode field hasil datalog karena isi file `.gz` bisa berubah / berbeda antar device. Backend mengirim metadata kolom (`columns`) dan baris (`rows`) sehingga UI otomatis:

- render table,
- show / hide / reorder column,
- filter per field,
- chart time-series,
- map tracking berdasarkan koordinat GPS.

> **Prinsip utama: as-is.** Backend mengembalikan SELURUH field dari `.gz` persis seperti aslinya. Tidak ada normalisasi nilai, tidak ada penggantian nama field, dan **tidak ada penanganan sentinel** (`-9999` = no data, `-8888` = no GPS fix tetap dikirim apa adanya). FE yang memutuskan cara menampilkan / memetakan field.

---

## Arsitektur

| Layer | File |
| --- | --- |
| Controller | `Controllers/DatalogRecordController.cs` |
| Service | `Services/DatalogRecordService.cs` |
| DTO / Models | `Models/DatalogRecordModels.cs` |
| DI | `Program.cs` → `builder.Services.AddScoped<DatalogRecordService>()` |
| Frontend page | `frontend-v1/src/pages/DatalogRecord.jsx` |
| Frontend date filter | `frontend-v1/src/components/datalog/DateRangeFilter.jsx` |

Base URL: `/Monitoring/api/DatalogRecord` — controller route `[Route("api/DatalogRecord")]`, prefix `/Monitoring` ditambahkan reverse proxy.

Service mengikuti pola `S3DataService` (resolve unit → device → S3 key dari `tbl_t_datalog_s3_availability`, download `.gz`, `GZipStream` decompress, parse JSON-lines), tetapi **tidak** memetakan ke model `TrackingPoint` yang field-nya fix — melainkan menyimpan tiap baris sebagai `Dictionary<string, object?>` berisi semua key apa adanya.

---

## Data Source

### Device Tree

`GET /Monitoring/api/DatalogRecord/devices?district=BRCB`

Sumber: `tbl_r_device` (DbSet `Devices`) difilter `distrik`, di-group `type_unit` → `unitno` + `deviceid`.

Response:

```json
{
  "district": "BRCB",
  "types": [
    { "type": "DT", "units": [ { "unitno": "DT4017", "device_id": "867395078102163" } ] },
    { "type": "LO", "units": [ { "unitno": "LO181", "device_id": "SDLIR001" } ] }
  ]
}
```

### Datalog availability

S3 key di-resolve dari `tbl_t_datalog_s3_availability` (`distrik`, `unitno`, `deviceid`, `wita_date`, `wita_hour`, `s3_file_path`, `file_exists`). Query filter: `distrik` + `unitNos` + rentang `wita_date` + `file_exists`. Filter waktu presisi dilakukan ulang per-baris pakai `timestampiso` (lihat di bawah).

---

## Search API

`POST /Monitoring/api/DatalogRecord/search`

Request:

```json
{
  "district": "BRCB",
  "unitNos": ["DT4017", "DT3272"],
  "startDateTime": "2026-06-22T00:00:00",
  "endDateTime": "2026-06-22T23:59:59",
  "page": 1,
  "pageSize": 50,
  "filters": [
    { "field": "gpsspeed", "operator": "contains", "value": "24" },
    { "field": "gpschosen", "operator": "equals", "value": "Module" }
  ],
  "visibleFields": ["unitno", "timestampiso", "gpslat", "gpslong", "gpsspeed"]
}
```

Response:

```json
{
  "success": true,
  "warnings": [],
  "columns": [
    { "key": "unitno",       "label": "unitno",       "type": "string",   "fixed": true,  "defaultVisible": true },
    { "key": "deviceid",     "label": "deviceid",     "type": "string",   "fixed": true,  "defaultVisible": true },
    { "key": "timestampiso", "label": "timestampiso", "type": "datetime", "fixed": false, "defaultVisible": true },
    { "key": "gpslat",       "label": "gpslat",       "type": "number",   "fixed": false, "defaultVisible": true },
    { "key": "gpslong",      "label": "gpslong",      "type": "number",   "fixed": false, "defaultVisible": true },
    { "key": "RPM",          "label": "RPM",          "type": "number",   "fixed": false, "defaultVisible": false }
  ],
  "rows": [
    {
      "rowid": "1753837927755-SDLIR001",
      "unitno": "LO181",
      "deviceid": "SDLIR001",
      "timestampiso": "20250730011207",
      "gpslat": 1.91580867,
      "gpslong": 117.29214367,
      "gpsspeed": 0.022,
      "gpsnumsat": 5,
      "VehicleSpeed": -9999,
      "RPM": 0
    }
  ],
  "page": 1,
  "pageSize": 50,
  "totalRows": 3599
}
```

### Dynamic Columns

`columns` dibentuk dari **union seluruh key** yang muncul di rows.

Aturan (lihat `BuildColumns`):

- `key` = nama field mentah dari `.gz` (as-is).
- `label` = **selalu sama dengan `key`** (tidak ada relabel jadi nama ramah).
- `type` = `string | number | boolean | datetime | geo`, di-infer dari nilai (bool → `boolean`, angka → `number`, selain itu `string`).
- `fixed` / `defaultVisible` diambil dari `KnownColumns` (hanya untuk metadata tampilan, **bukan** untuk relabel). Default visible: `unitno`, `deviceid`, `timestampiso`, `gpslat`, `gpslong`, `gpsspeed`, `gpsnumsat`.
- Jika `visibleFields` dikirim, `defaultVisible` mengikuti daftar itu.

Kalau `.gz` menambah field baru, otomatis masuk `columns` + tiap `row` tanpa perubahan kode.

---

## Struktur file `.gz` nyata (hasil inspeksi S3)

Diverifikasi dari file produksi (mis. `datalog/BRCB/SDLIR001/2025073001/2025073001.txt.gz`):

- Format: **gzip** berisi **JSON-lines** (1 objek JSON per baris).
- **~210 field per baris**, stabil dalam satu file.
- Field kunci:
  - `timestampiso` — string `yyyyMMddHHmmss` (waktu device, dipakai untuk sort & filter range).
  - `gpslat`, `gpslong` — derajat desimal (mis. `1.91580867`).
  - `gpsspeed` — speed GPS (float), `gpsnumsat` — jumlah satelit.
  - `unitno`, `deviceid` — sudah ada di dalam data mentah.
  - `devicestatus` — **objek bersarang** → disimpan sebagai raw JSON string.
- **Sentinel** (`-9999` no data, `-8888` no GPS fix) **dikirim apa adanya**, tidak dibersihkan.

### Path S3 & file corrupt

`s3_file_path` di availability bisa mengarah ke dua pola, mis.:

- `datalog/BRCB/{device}/{yyyyMMddHH}/{yyyyMMddHH}.txt.gz`
- `dataloguploader/BRCB/{device}/{yyyyMMdd}/{yyyyMMddHH}.txt.gz`

Sebagian file bisa **corrupt** (header gzip ditulis tapi body berisi byte nol; `gzip.decompress` gagal "invalid stored block lengths") — kemungkinan uploader terputus. Backend menangani ini per-file: file gagal **dilewati**, request keseluruhan tetap sukses, dan pesannya masuk `warnings[]` (lihat Error Handling).

---

## Chart API

`POST /Monitoring/api/DatalogRecord/chart`

```json
{
  "district": "BRCB",
  "unitNos": ["DT4017"],
  "startDateTime": "2026-06-22T00:00:00",
  "endDateTime": "2026-06-22T23:59:59",
  "timestampField": "timestampiso",
  "metrics": ["gpsspeed", "RPM"],
  "filters": []
}
```

Response: `series[].points[] = { ts, value }`. Nilai dikirim apa adanya (sentinel ikut; FE memutuskan).

> Catatan: FE saat ini menurunkan chart langsung dari rows `/search` (lihat Frontend). Endpoint `/chart` tersedia untuk dataset besar.

## Maps API

`POST /Monitoring/api/DatalogRecord/map`

```json
{
  "district": "BRCB",
  "unitNos": ["DT4017", "DT3272"],
  "startDateTime": "2026-06-22T00:00:00",
  "endDateTime": "2026-06-22T23:59:59",
  "includeDotTrace": true,
  "filters": []
}
```

Response: `tracks[] = { unitno, device_id, path[], last }` dengan point `{ ts, lat, lon, speed }` dari `gpslat`/`gpslong`/`gpsspeed`. Hanya point yang lat/lon numerik yang diplot.

> Catatan: FE saat ini menurunkan map langsung dari rows `/search`. Endpoint `/map` tersedia untuk dataset besar.

---

## Filtering

Operator MVP (diterapkan setelah parsing, atas nilai apa adanya):

- `contains` — substring, case-insensitive.
- `equals` — string equals (case-insensitive) atau numeric-equal.

Future: `gt / gte / lt / lte / between / is_empty / not_empty`.

## Pagination

Parse file yang cocok → apply filter → sort by `timestampiso` → `page` / `pageSize`. Response menyertakan `page`, `pageSize`, `totalRows`.

Guard memory: `MaxParsedRows = 200_000` (kalau terlampaui, ditambahkan warning agar user mempersempit range/unit).

## Error Handling

Per-file, tidak menggagalkan seluruh request:

```json
{
  "success": true,
  "warnings": [
    "Missing file: dataloguploader/BRCB/DT4017/20260622/2026062208.txt.gz",
    "Failed to read: dataloguploader/BRCB/SLS30I427/20260622/2026062204.txt.gz"
  ],
  "columns": [],
  "rows": []
}
```

- S3 404 → `Missing file: …`
- gzip corrupt / parse error → `Failed to read: …`
- truncation oleh `MaxParsedRows` → warning khusus.

---

## Frontend Progress

Halaman: `frontend-v1/src/pages/DatalogRecord.jsx` (sudah terhubung ke backend).

### Selesai

- **Device tree** dari `GET /devices` — sidebar `district → type → unit`, search, multi-select unit.
- **Search** ke `POST /search` — render tabel dari `columns` + `rows` dinamis.
  - Header kolom **as-is** (`label = key`), plus kolom indeks **"No."**.
  - Dialog **Column Filtering**: show all / reset default, show-hide-reorder per kolom.
  - Filter per kolom (contains/equals) di header.
  - Pagination (25/50/100 per page).
- **Date Range filter** — `components/datalog/DateRangeFilter.jsx`:
  - Popover preset: **Last Hour**, Today, Yesterday, Last 24 Hours, Last 2 / 3 / 7 / 30 Days.
  - Granularitas **per-jam** (menit `:00`) pakai date input + **kolom jam scroll inline** (bukan dropdown melayang) — pola FilterModal, tanpa dependency baru (MUI + date-fns).
- **Custom field mapping** (map & chart) — user memilih field mana yang jadi `latitude` / `longitude` / `speed` / X-axis. Default auto-deteksi dari nama (`gpslat`/`gpslong`/`gpsspeed`) dengan opsi override.
- **Time-series chart** (dialog) — SVG lebar terukur (`ResizeObserver`, tidak distorsi), **normalisasi per-metric** (0–100%, range asli di legend), gridlines + label sumbu, **hover crosshair + tooltip**. User pilih X-axis field + metric numerik.
- **Maps** (dialog, deck.gl di `MapContainer`) — `PathLayer` jalur + `ScatterplotLayer` dot-trace **diwarnai berdasarkan speed** (biru→hijau→merah) + legend, marker posisi terakhir, label unit, **auto fit-to-data** saat dibuka.

### Catatan integrasi

- Chart & Map saat ini diturunkan **client-side** dari rows `/search`. Endpoint `/chart` & `/map` backend tersedia bila rows terlalu besar.
- FE membaca `gpslat`/`gpslong`/`gpsspeed`/`timestampiso` apa adanya; tidak ada asumsi field ternormalisasi.
- Validasi koordinat di FE: skip `0,0` dan di luar rentang lat/lon valid sebelum diplot.

### Belum / Future

- Operator filter lanjutan (gt/lt/between/empty) di FE & BE.
- Streaming parse + caching metadata per file untuk range panjang.
- Beralih ke endpoint `/chart` & `/map` untuk dataset besar.
