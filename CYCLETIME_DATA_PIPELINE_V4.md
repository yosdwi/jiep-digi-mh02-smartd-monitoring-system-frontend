# Cycle Time / Playback — Audit Pipeline Data & Arsitektur V4

Companion untuk `CYCLETIME_STACK_AUDIT_V3.md` (frontend/rendering) dan
`CYCLETIME_PLAYBACK_PERFORMANCE_RESEARCH.md` (animation loop).
Dokumen ini menjawab pertanyaan yang berbeda dari keduanya:

> **Kenapa fetch data 2 jam untuk semua unit butuh berjam-jam, dan bentuk
> arsitektur data yang benar itu seperti apa.**

Berbeda dari dua dokumen sebelumnya yang murni hasil baca source, semua angka di
bawah ini **diukur langsung dari S3 produksi (`smartdbucket`) pada 2026-08-17**,
bukan diperkirakan.

Kesimpulan di depan: **format binary (Arrow/Parquet) bukan levernya, dan
frontend bukan penyebabnya.** Penyebabnya ada di tiga lapis di bawah itu —
format sumber, jumlah objek per query, dan bentuk query — dengan selisih empat
orde besaran.

> **Catatan urutan baca.** §1–§8 adalah jejak analisis yang membawa ke dua PoC,
> dan rekomendasinya di sana (perbaiki `DatalogServingMaterializer`, tetap di
> Parquet+S3) **sudah digantikan**. Hasil pengukuran kedua PoC dan putusan
> akhirnya ada di **§9**. Yang mengubah keputusan bukan performa Parquet —
> itu terbukti baik — melainkan *lead time* materialisasi (≤1 jam) dan fakta
> bahwa jalur raw sekarang **OOM, bukan sekadar lambat**. Kalau hanya punya
> waktu baca satu bagian, baca §9.

---

## 1. Angka hasil pengukuran

### 1a. Biaya satu objek sumber

Objek: `dataloguploader/BRCB/SDLIR004/20260707/2026070700.txt.gz`

| | |
|---|---|
| Ukuran terkompresi | 267 KB |
| Ukuran setelah dekompresi | **17.5 MB** |
| Rasio kompresi | **65.7×** |
| Baris | 3,600 (1 baris/detik) |
| Kolom per baris | 209 |
| Byte per baris JSON | 4,863 |

Rasio 65.7× itu angka penting. Gzip menyembunyikan biaya sebenarnya: yang
"cuma 90 MB" di S3 adalah **4.5 GB teks JSON** yang harus di-parse.

### 1b. Volume per distrik

BRCB, tanggal 2026-08-16, hasil `list_objects_v2` penuh:

| | |
|---|---|
| Device aktif di BRCB | 212 (dari 381 prefix device yang ada) |
| Objek `.txt.gz` satu hari | **5,912** |
| Byte terkompresi satu hari | 2.01 GB |
| Objek per jam | ~260 |
| Byte per jam | ~90 MB gz → **~4.5 GB JSON** |
| Byte per hari | 2 GB gz → **~132 GB JSON** |

### 1c. Biaya baca — diukur, `SET threads=2` (sama seperti `DuckDbSourceReader`)

Query berbentuk sama persis dengan `ProjectedReadSql` (projeksi + `QUALIFY`
dedup), dijalankan dari laptop dev ke `ap-southeast-3`:

| Sumber | Waktu |
|---|---|
| `read_json` 10 objek `.gz` | 8.73 s |
| `read_json` 40 objek `.gz` | 37.36 s |
| → per objek | **~0.93 s** (linear) |
| **ekstrapolasi 283 objek = 1 jam BRCB, 1 pass** | **~264 s** |

### 1d. Latensi S3 per objek

| | |
|---|---|
| Median latency `GetObject` | **185 ms** |
| Throughput agregat (concurrency 2) | 0.5 MB/s |
| Throughput agregat (concurrency 32) | 0.9 MB/s, median latency naik ke 1,160 ms |

### 1e. Perbandingan langsung — objek gabungan yang sudah ada

`datalog-serving/v1/district=BRCB/wita_date=2026-08-14/wita_hour=01/...parquet`
(output `DatalogServingMaterializer` yang sudah sempat jalan):

| | |
|---|---|
| Baris | 442,667 |
| Device | 133 |
| Kolom | 216 |
| Ukuran | 28.4 MB |
| `SELECT count(*), min(gpslat), max(gpslong)` | **0.20 s** |

**Satu jam distrik: 264 detik lewat jalur raw, 0.20 detik lewat satu objek
Parquet gabungan. Selisih ~1,300×.**

### 1f. Biaya materialisasi — diukur end-to-end

Satu jam BRCB penuh (2026-07-07 jam 00 WITA) dimaterialisasi dengan aturan
dedup yang benar (§3.5), `threads=2`, `memory_limit=2GB`, dari laptop dev:

| | |
|---|---|
| File sumber | 281 `.txt.gz` (2 objek rusak dikecualikan, lihat §3.6) |
| **Waktu total** | **198,3 detik (3,3 menit)** |
| Per file | 0,71 s |
| Hasil | 870.860 baris, 280 device |
| Ukuran output | 42,5 MB (ZSTD, 10 part) |
| Baca 1 device dari hasil | 0,04 s |

Konsumsi bandwidth efektif 0,38 MB/s dari plafon ~0,9 MB/s link ini — jadi
sekitar setengahnya CPU (parsing JSON), setengahnya jaringan.

Volume harian kedua distrik, untuk menskalakan angka di atas:

| Distrik | File/hari | File/jam | Byte gz/hari |
|---|---|---|---|
| BRCB | 5.912 | ~260 | 2,01 GB |
| BRCG | 4.332 | ~180 | 1,23 GB |
| ARIA | ~0 (parquet, 2 device) | — | — |
| **Total** | **10.244** | **~440** | **3,24 GB** |

Pada 0,71 s/file: **~2 jam per hari-kalender untuk kedua distrik, serial, di
laptop ini.** Backfill satu minggu ≈ 14 jam serial, atau ~6–8 jam dengan
concurrency 3 (dibatasi plafon link, bukan CPU).

Di dalam cluster (satu region dengan bucket, `threads` mengikuti CPU limit)
plafon 0,9 MB/s itu hilang dan bagian parsing bisa memakai lebih banyak core —
perkiraan kasar 3–5× lebih cepat, jadi ~25–40 menit per hari-kalender dan
~3–5 jam untuk backfill seminggu. **Angka in-cluster ini ekstrapolasi, belum
diukur** — memverifikasinya adalah salah satu keluaran Fase 1.

---

## 2. Anggaran biaya query "2 jam, semua unit"

`PlaybackV2Service.ProcessQueryAsync` (baris 245–300) menjalankan **tiga scan
penuh** atas himpunan file yang sama, masing-masing membuka **koneksi DuckDB
baru** (`_reader.OpenAsync()` → in-memory DB baru + `INSTALL httpfs` lagi),
jadi tidak ada satu byte pun yang dipakai ulang antar pass:

1. `CountPointsAsync` — baris 523
2. `ReadPreviewPointsAsync` — baris 544
3. `CountPreviewSamplingAsync` — baris 598

Maka:

```
260 device × 2 jam                    =    520 objek
× 3 pass                              =  1,560 pembacaan objek
× 17.5 MB JSON per objek              = ~27 GB teks JSON di-parse
× 0.93 s/objek (terukur, threads=2)   = ~24 menit  ← lantai teoretis di laptop
```

24 menit itu **batas bawah**, di kondisi terbaik. Yang menambah di atasnya:

- `union_by_name=true` atas 520 file dengan schema dinamis yang tidak identik —
  DuckDB harus infer + rekonsiliasi schema 209+ kolom lintas semua file, biayanya
  superlinear terhadap jumlah file, bukan linear.
- `ReadPreviewPointsAsync` menjalankan lima window function berantai
  (`row_number`, `count`, `lag`, `min`, `max` OVER PARTITION) di atas ~1.8 juta
  baris × 209 kolom, dengan `memory_limit='2GB'` → spill ke disk.
- `SET threads=2` dan `QueryGate = SemaphoreSlim(1,1)` — semua query playback
  antre satu per satu, global untuk seluruh pod.
- Pod produksi punya CPU lebih kecil dari laptop dev ini.

**Berjam-jam itu konsisten dengan hitungan ini.** Tidak ada anomali yang perlu
dicari; ini biaya yang memang diminta oleh desainnya.

---

## 3. Akar masalah, terurut menurut besar dampak

### 3.1 Format sumber: JSON-lines gzip — **dampak ~50×**

`.txt.gz` adalah format terburuk yang mungkin untuk beban kerja analitik:

- **Tidak ada projection pushdown.** Playback butuh 12 kolom
  (`ProjectedReadSql`: deviceid, unitno, timestampiso, gpslat, gpslong,
  VehicleSpeed, gpsspeed, plm_status, HM, Fuel_level_TM, act_tonnage). Untuk
  mendapat 12 kolom itu, seluruh 209 kolom harus di-dekompresi dan di-parse.
  **~94% pekerjaan terbuang.**
- **Tidak ada predicate pushdown / statistik.** Filter `timestamp_key >= X` baru
  bisa dievaluasi setelah semua baris jadi. Tidak ada row-group stats untuk skip.
- **Gzip tidak seekable.** Tidak bisa baca sebagian; setiap request menarik objek
  utuh. `OFFSET` untuk pagination tidak menghemat I/O sama sekali — ini sudah
  dicatat di `DATALOG_DUCKDB_PROGRESS.md` §TODO 2, tapi belum ditindak.
- **Parsing JSON mahal.** Bukan I/O bound, CPU bound: 4.9 KB teks per baris untuk
  menghasilkan ~100 byte data berguna.

### 3.2 Layout objek: satu objek per (device, jam) — **dampak ~10×**

Ini yang paling sering terlewat, dan yang bertahan **walaupun formatnya diganti
Parquet.**

Bukti langsung: 269 objek Parquet kecil (total hanya **15 MB**) untuk satu jam
BRCB → query `count + min/max` butuh **86 detik**. 15 MB dalam 86 detik bukan
masalah bandwidth. Itu 269 × (round-trip metadata + baca footer + baca column
chunk) pada latensi 185 ms, dibagi 2 thread.

Bandingkan: objek gabungan 28.4 MB (dua kali lipat byte-nya, 216 kolom) →
**0.20 detik**.

**Query terikat pada jumlah objek, bukan jumlah byte.** Selama fan-out per query
masih ratusan objek, tidak ada format yang bisa menyelamatkan.

### 3.3 Bentuk query: tiga pass, koneksi sekali pakai — **dampak 3×**

Lihat §2. Ketiga query itu berbagi CTE `src` yang identik dan window function
yang identik; `CountPreviewSamplingAsync` bahkan hanya versi `GROUP BY` dari
`ReadPreviewPointsAsync`. Ini satu query yang ditulis tiga kali.

Ditambah `SET threads=2` (`DuckDbSourceReader.cs:41`) — hard-coded, tidak
mengikuti CPU limit pod.

### 3.4 Materializer tidak pernah mengejar — **alasan kenapa 3.1/3.2 masih terasa**

Arsitektur yang benar sudah ada di repo. Ia tidak jalan karena empat hal:

- **Reconcile-scan, bukan event-driven.** Worker memindai 7 hari terakhir dari
  `tbl_t_datalog_s3_availability` setiap 30 menit dan meng-enqueue **semua**
  (distrik, tanggal, jam) — itu 7 × 24 × 2 distrik = 336 item per siklus, dengan
  **concurrency 1**, sementara satu materialisasi butuh menit-menitan karena ia
  sendiri membaca `.gz` raw. Secara aritmetika tidak mungkin mengejar.
- **Jam berjalan terus dibangun ulang.** Kondisi state S3 aktual:
  **34 generation ada, tapi hanya 8 jam berbeda — 27 di antaranya adalah
  rebuild berulang dari jam yang sama (2026-08-14 19:00).** Penyebabnya:
  `ComputeSourceFingerprint` memakai `LastModifiedS3`, dan jam yang masih
  berjalan terus menerima file baru, jadi fingerprint selalu berubah dan
  skip-check tidak pernah kena. ~1 GB objek S3 terbuang, dan slot
  concurrency-1 habis untuk pekerjaan yang dibuang.
- **Filter tes yang masih tertinggal.** `DatalogServingMaterializer.cs:52-55`:

  ```csharp
  // ponytail: TEMP test-only filter, DT units only
  && x.UnitNo.StartsWith("DT")
  ```

  Ini yang menjelaskan 133 device di generation vs ~260 device di raw.

- **Ini bukan cuma soal performa — ada bug korektnes.**
  `PlaybackV2Service.ResolveFilesAsync` (baris 511-513) membuang **seluruh** baris
  raw untuk jam yang sudah punya generation:

  ```csharp
  files.AddRange(rawRows
      .Where(r => !coveredHours.Contains((r.WitaDate, r.WitaHour)))
      ...
  ```

  Digabung dengan filter `DT` di atas: untuk setiap jam yang punya generation,
  **semua unit non-DT kehilangan datanya sama sekali** — bukan lambat, tapi
  hilang tanpa warning. Perbaiki ini sebelum apa pun yang lain.

### 3.5 Semantik duplikat & timestamp — dedup yang sekarang salah

Ini temuan terpisah dari performa, hasil membongkar isi satu objek raw. Ia
menentukan bentuk produk serving, jadi harus diputuskan sebelum materializer
dibetulkan.

**Kolom kunci yang sebenarnya sudah ada:**

| Kolom | Isi | Catatan |
|---|---|---|
| `heartbeat` | unix epoch detik, mis. `1783382400` | jam otoritatif dari device |
| `startheartbeat` | epoch saat device boot | konstan per sesi device |
| `rowid` | `"{heartbeat}-{deviceid}"` | **primary key alami dari producer** |
| `timestampiso` | `"20260707080000"` = heartbeat + 8 jam (WITA) | **turunan, dan bisa salah** |

Dalam satu file (3.600 baris) `heartbeat + 8 jam != timestampiso` pada **5 baris**.
`timestampiso` adalah string turunan yang di-parse ulang di setiap query
(`strptime` di `ProjectedReadSql`), sementara `heartbeat` sudah berupa integer
epoch yang benar. **Pakai `heartbeat`, jangan `timestampiso`.**

**Duplikatnya bukan duplikat sungguhan.** Dalam file yang sama ada 33 `rowid`
kembar. Isinya tidak identik — yang berbeda persis kolom GPS:

```
rowid 1783382586-SDLIR004  gpslat 1.906261667  gpslong 117.293218333  gpsspeed 14.6
rowid 1783382586-SDLIR004  gpslat 1.906267500  gpslong 117.293257667  gpsspeed 16.5
```

Kualitas fix-nya identik (`gpsnumsat` 11, `gpshdop` 0.75, `fix_quality` 2 DGPS)
— jadi tidak ada sinyal kualitas yang bisa dipakai memilih. Ini **dua fix GPS
dalam satu detik yang sama**: heartbeat berdetak per detik, GPS kadang mengirim
lebih cepat. Truk bergerak maju di antara keduanya, dan keduanya berdampingan di
urutan file (jarak baris 1 atau 2).

Konsekuensinya untuk `DuckDbSourceReader.ProjectedReadSql` baris 101-104:

```sql
QUALIFY row_number() OVER (
    PARTITION BY deviceid, timestampiso
    ORDER BY source_object, unitno, latitude, longitude, speed_value, plm_status
) = 1
```

- **Partisi salah** — `timestampiso` (string turunan) dipakai, bukan `heartbeat`.
- **Tie-break salah** — memilih berdasarkan **nilai** `latitude`. Untuk truk yang
  bergerak ke selatan ini memilih fix yang lebih baru, ke utara memilih yang
  lebih lama. Hasilnya tidak berhubungan dengan waktu sama sekali.
- **Urutan file sudah hilang** — `DuckDbSourceReader.cs:40` menyetel
  `SET preserve_insertion_order=false`, jadi urutan baris dalam objek sumber
  (satu-satunya sinyal temporal yang benar untuk kasus sub-detik ini) tidak bisa
  direkonstruksi lagi di titik mana pun setelahnya.

Komentar di `DATALOG_DUCKDB_PROGRESS.md` benar bahwa semantik dedup ini
"load-bearing" — tapi yang load-bearing itu ternyata salah.

**Aturan yang benar, untuk dipakai di materializer:**

1. Kunci dedup = `rowid` (setara `(deviceid, heartbeat)`) — PK milik producer
   sendiri, bukan string turunan.
2. Tie-break = **urutan baris dalam objek sumber**, ambil yang terakhir (posisi
   paling segar untuk detik itu). Materializer harus menstempel
   `source_row_no` eksplisit saat membaca, dengan insertion order dipertahankan,
   karena setelah itu informasinya hilang selamanya.
3. Setelah materialisasi, produk serving punya satu baris per `rowid` dan
   downstream **tidak perlu dedup lagi** — hilangkan `QUALIFY` dari jalur query.

**Sentinel:** `-9999` (tidak ada data) dan `-8888` (tidak berlaku) dipakai
sebagai nilai magis di seluruh kolom numerik, bukan `null`. Terbukti bocor ke
hasil: `min(gpslat)` pada generation yang ada mengembalikan `-8888.0`.
Normalkan jadi `NULL` saat materialisasi — Parquet menyimpan null hampir gratis,
dan query berhenti bergantung pada filter implisit seperti
`latitude BETWEEN -90 AND 90` di `ReadPreviewPointsAsync`.

Dari 209 kolom, **23 di antaranya 100% kosong/sentinel** di file sampel.
Setelah normalisasi null, kolom-kolom itu menyusut jadi hampir nol byte di
Parquet tanpa perlu dibuang dari schema — yang penting karena §4.2.

### 3.6 Objek sumber rusak + loop retry yang memperbaiki file yang salah

Ditemukan saat mencoba materialisasi 1 jam BRCB penuh. Dari 283 objek, **2
tidak terbaca (0,7%)** — dan keduanya rusak dengan cara yang berbeda:

| Objek | Kondisi | Pesan DuckDB | Menyebut nama file? |
|---|---|---|---|
| `SLS30I105/…/2026070700.txt.gz` | **0 byte** | `Input is not a GZIP stream: s3://…/SLS30I105/…` | ya |
| `SLS30I568/…/2026070700.txt.gz` | gzip **terpotong** (14.535 byte, magic benar, body rusak) | `Failed to decode gzip stream: data error` | **tidak** |

Mode kedua itu masalahnya. Pesan errornya tidak memuat nama file penyebab —
yang muncul hanya potongan awal daftar file di SQL. Sementara
`DatalogServingMaterializer.TryExtractSourceKey` mencocokkan regex terhadap
pesan itu:

```csharp
private static readonly Regex SourceKeyPattern =
    new(@"(datalog(?:uploader)?/[^\s""':]+\.(?:txt\.gz|parquet))", RegexOptions.Compiled);
```

Pada pesan mode kedua, yang cocok pertama adalah **file pertama dalam daftar**
— file yang sehat. Jadi loop retry di baris 113-132:

1. mengeluarkan file sehat yang salah tuduh,
2. mengulang **seluruh pembacaan dari awal** (~3,3 menit untuk satu jam BRCB),
3. gagal lagi dengan pesan yang sama, menuduh file sehat berikutnya,
4. ulangi sampai `attempt == files.Count`.

Batas atasnya `files.Count` percobaan × biaya penuh sekali baca. Untuk satu jam
BRCB itu **283 × 3,3 menit ≈ 15 jam**, dan setiap percobaan membuang satu unit
sehat dari hasil. Bahkan berhenti setelah beberapa iterasi sudah menghabiskan
puluhan menit.

Error persis mode kedua ini sudah pernah tercatat — lihat baris terakhir
`DATALOG_DUCKDB_PROGRESS.md`:

```
IO Error: Failed to decode gzip stream: data error LINE 21: FROM (SELECT * FROM
read_json(['s3://smartdbucket/dataloguploader/BRCB/SLS30I022...
```

Jadi ini bukan kejadian tunggal.

**Perbaikannya murah: validasi di depan, bukan retry di belakang.**

- **0 byte** — terdeteksi gratis dari metadata. `DatalogS3SyncService` sudah
  membaca `Size` dari `ListObjectsV2`, tapi `tbl_t_datalog_s3_availability`
  tidak menyimpannya (tabel hanya punya `FileExists`, `LastModifiedS3`).
  Tambah kolom `SizeBytes`, lalu materializer memfilter `SizeBytes > 0`.
- **gzip terpotong** — tidak bisa dideteksi dari metadata, perlu dekompresi
  betulan. Memindai 283 objek dengan 40 thread terukur **89 detik**, yaitu +45%
  di atas biaya materialisasi itu sendiri — terlalu mahal untuk dijalankan
  setiap kali.

  Batching (§4.4) menyelesaikannya jauh lebih murah: satu objek rusak hanya
  menggagalkan **satu batch berisi 30 file (~21 detik)**, bukan seluruh jam.
  Batch yang gagal diulang file-per-file untuk mengisolasi penyebabnya —
  biayanya terbatas 30 pembacaan (~21 detik), bukan 283. Batch lain tetap
  menghasilkan part-nya masing-masing.
- Buang loop retry berbasis regex sepenuhnya. Objek yang gagal validasi dicatat
  ke manifest (`failed_reason`) supaya kelihatan di panel status (§4.4), bukan
  hilang diam-diam.

### 3.7 Yang **bukan** penyebab

- **Arrow sebagai wire format.** Benar dan tetap dipakai. Ia mengoptimasi
  transfer ~3,600 baris per chunk; masalahnya empat orde besaran di hulu.
- **Format binary vs JSON di layer transport.** Sama, bukan levernya.
- **deck.gl / React / MUI.** Sudah dibahas di `CYCLETIME_STACK_AUDIT_V3.md`;
  itu masalah smoothness yang terpisah dan jauh lebih kecil.
- **DuckDB sebagai engine.** Terbukti bagus — 442k baris × 216 kolom dalam 0.20 s.
  Yang salah adalah apa yang disuruh dibaca.

---

## 4. Arsitektur target

Prinsipnya satu kalimat:

> **Bayar sekali saat tulis, jangan bayar berulang saat baca.
> Query harus menyentuh jumlah objek yang konstan, bukan proporsional terhadap
> jumlah unit.**

### 4.1 Bentuk layout

```
Sekarang   query(2 jam, 260 unit) → 520 objek × 3 pass = 1,560 objek
Target     query(2 jam, 260 unit) → 2 objek × 1 pass   = 2 objek
```

Kuncinya bukan "pakai Parquet", tapi **satu objek per (distrik, jam)**, karena
partisi itulah yang membuat fan-out tidak lagi bergantung pada jumlah unit.

### 4.2 Satu produk serving, lebar penuh — bukan dua

Pertimbangan awal adalah memisahkan produk "track" sempit (~14 kolom) untuk
playback dari produk "wide" untuk Datalog Record. **Itu dibatalkan**: schema
sumber bersifat dinamis, kolom baru akan terus bertambah (GPS, CANbus, VHMS,
MIR, mine-awareness masing-masing tumbuh sendiri-sendiri), dan produk sempit
akan menjadi hutang yang harus diedit setiap kali sensor baru masuk.

Satu produk, passthrough penuh — persis seperti yang ditulis materializer hari
ini — dengan tambahan berikut:

| Aspek | Keputusan |
|---|---|
| Partisi | satu objek per **(distrik, tanggal, jam WITA)** |
| Kolom | passthrough penuh, kolom baru ikut otomatis (`union_by_name`) |
| Kunci dedup | `rowid` (= `heartbeat` + `deviceid`), lihat §3.5 |
| Tie-break | `source_row_no` (urutan baris dalam objek sumber), ambil terakhir |
| Timestamp kanonik | `heartbeat` (BIGINT epoch detik) + `timestamp_ms` turunan |
| `timestampiso` | tetap disimpan apa adanya, tapi **tidak dipakai** untuk kunci/urutan |
| Sentinel | `-9999` / `-8888` → `NULL` |
| Sort | `(deviceid, heartbeat)` |
| Row group | ~100k baris, `COMPRESSION ZSTD` |

**Kenapa produk lebar tetap cepat — diukur, bukan diasumsikan.** Parquet punya
projection pushdown: query yang menyentuh 11 kolom hanya membaca column chunk 11
kolom itu, sisanya tidak disentuh. Diuji atas objek generation yang sudah ada
(442.667 baris, 216 kolom, 28,4 MB):

| Query | Waktu |
|---|---|
| **1 device × 1 jam, 11 kolom** (persis beban `GetChunkAsync`) | **0,13 s** |
| 1 device × 1 jam, 216 kolom (beban tab Datalog) | 8,53 s |
| semua device × 1 jam, 11 kolom | 8,24 s |
| semua device × 1 jam, 216 kolom | 35,35 s |

Barisnya sama persis di keempat kasus — yang berbeda hanya jumlah kolom yang
diminta. **Playback membayar 0,13 detik walaupun filenya menyimpan 216 kolom.**
Menyimpan seluruh field jadi praktis gratis untuk playback; biaya kolom lebar
hanya ditanggung yang benar-benar memintanya, yaitu tab Datalog — yang memang
membutuhkannya.

Itulah alasan Parquet dipilih ketimbang menyempitkan schema secara manual:
penyempitan tidak perlu dilakukan di sisi tulis, karena sudah terjadi otomatis
di sisi baca.

(Angka di atas dari laptop dev dengan throughput ~0,9 MB/s. Yang bermakna adalah
rasio antar baris tabel, bukan nilai absolutnya.)

Normalisasi sentinel jadi `NULL` (§3.5) yang membuat ini benar-benar murah:
23 kolom yang isinya sentinel semua menyusut jadi hampir nol byte, alih-alih
menyimpan `-9999` sebanyak 442.667 kali.

### 4.3 Serving hanya dari generation — tanpa fallback ke raw

Keputusan: **jalur V3 tidak pernah membaca `.gz` raw.** Sumber raw tetap ada di
S3 sebagai kebenaran/audit, tapi bukan lagi jalur baca aplikasi.

Ini sekaligus menghapus bug §3.4 secara struktural: tidak ada lagi pencampuran
generation + raw, jadi tidak ada lagi `coveredHours` yang bisa menutupi baris
raw dan menghilangkan unit.

Yang terjadi kalau sebuah jam belum punya generation `ready`: **materialisasi
on-demand**, bukan fallback dan bukan error.

```
CreateQueryAsync
  └─ cek manifest untuk tiap jam dalam range
       ├─ semua ready  → state "running", langsung baca, sub-detik
       └─ ada yang belum → enqueue jam yang kurang (prioritas tinggi),
                            state "queued", progress = jam_selesai / jam_total
                            → begitu semua ready, lanjut baca
```

Mekanismenya sudah ada dan tidak perlu dibangun: `PlaybackV2Session` sudah punya
state `queued|running|preview_ready|ready` + `Progress`, dan frontend sudah
merender labelnya (`StateOverlay.loadingLabel`, "Antre query... N%" —
`DATALOG_DUCKDB_PROGRESS.md` §Update 2026-08-15). Yang berubah cuma **apa** yang
dihitung sebagai progress: dari progress query jadi progress materialisasi.

Efeknya untuk pengguna: query pertama ke sebuah jam membayar biaya
materialisasi (sekali, ~menit), setiap query berikutnya ke jam itu sub-detik —
oleh siapa pun, untuk kombinasi unit apa pun. Dengan backfill (§4.4) jalan di
latar, kasus "bayar sekali" ini menyusut jadi hampir tidak pernah terjadi.

### 4.4 Materializer: jam tutup, event-driven, plus backfill minggu berjalan

Empat perubahan pada worker yang sudah ada:

1. **Hanya jam yang sudah tutup.** Syarat `hourEnd < now - 10 menit`. Ini yang
   menghapus 27 rebuild berulang di §3.4 — jam berjalan tidak pernah disentuh,
   jadi `LastModifiedS3` yang terus berubah tidak lagi membatalkan fingerprint.
2. **Trigger dari `DatalogS3SyncService`** saat sebuah jam selesai disinkronkan,
   bukan dari pemindaian 7 hari tiap 30 menit. Reconcile tetap ada tapi turun
   peran jadi jaring pengaman: sekali per jam, hanya untuk jam tanpa generation
   `ready`.
3. **Concurrency 3–4**, dan kegagalan masuk exponential backoff, bukan langsung
   di-enqueue ulang siklus berikutnya.
4. **Hapus filter tes `UnitNo.StartsWith("DT")`** (`DatalogServingMaterializer.cs:52-55`).
   Semua unit ikut. Tanpa ini, "tanpa fallback" berarti unit non-DT tidak punya
   data sama sekali.
5. **Validasi objek di depan** (§3.6): filter `SizeBytes > 0`, cek gzip paralel,
   buang loop retry berbasis regex.
6. **Proses per batch device**, bukan satu jam sekaligus — lihat di bawah.

**Batching itu wajib, bukan optimasi.** Komentar `ponytail:` di
`DatalogServingMaterializer.cs:50-51` menyebut filter `DT` dipasang "so it fits
this laptop's RAM". Itu bukan keterbatasan laptop — diuji ulang: satu jam BRCB
penuh (283 file) dengan `memory_limit='2GB'` **OOM**, dan tetap OOM walaupun
`temp_directory` untuk spill sudah diset:

```
Out of Memory Error: failed to pin block of size 256.0 KiB (1.8 GiB/1.8 GiB used)
```

Penyebabnya `preserve_insertion_order=true` (yang dibutuhkan untuk menstempel
`source_row_no`, §3.5) digabung window function tanpa partisi — operator itu
tidak bisa spill, jadi menaikkan `memory_limit` cuma menggeser batasnya.
Menghapus filter `DT` saja akan membuat materializer gagal, bukan lambat.

Bentuk yang berhasil (terukur di §1f):

- Proses **30 file device per batch**, tiap batch menulis `part-NNNN.parquet`
  sendiri ke prefix generation yang sama. Memori terbatas pada satu batch.
- `source_row_no` distempel `row_number() OVER (PARTITION BY filename)` — hanya
  perlu urutan **dalam satu file**, bukan global.
- Dedup per batch **setara persis** dengan dedup global: `rowid` memuat
  `deviceid`, dan satu (device, jam) hanya punya satu objek sumber, jadi
  duplikat tidak pernah melintasi batas file. Tidak ada langkah penggabungan
  yang diperlukan.
- Generation jadi **prefix berisi ~10 part**, bukan satu objek. Untuk baca itu
  tidak masalah — 10 objek jauh di bawah ambang §3.2, dan terukur baca 1 device
  dari 10 part butuh 0,04 detik.
- Batch juga menampung schema drift: ada 3 varian schema dalam satu jam BRCB
  (209 / 209 / 219 kolom, union 225), plus konflik tipe antar file (`pos_hm_can`
  ter-infer `INT64` di satu file tapi berisi `1.57e+200` di file lain). Tiap
  part menyimpan schema-nya sendiri; `read_parquet(..., union_by_name=true)`
  saat baca sudah menanganinya — mekanisme yang sudah dipakai `BuildReadSql`.

**Backfill dibatasi minggu berjalan.** Bukan 7 hari bergulir dari materializer
lama — cakupannya eksplisit: dari Senin minggu ini sampai jam terakhir yang
tutup. Untuk 2 distrik itu ~168 jam-distrik per minggu; dengan concurrency 3 dan
~2 menit per jam-distrik, backfill dari nol selesai dalam ~2 jam. Data di luar
window itu tidak dilayani jalur V3 — kalau nanti dibutuhkan, window-nya digeser,
bukan mekanismenya yang diubah.

Tiga prioritas antrean, supaya backfill tidak pernah menahan pengguna:

| Prioritas | Sumber | Contoh |
|---|---|---|
| 1 | on-demand dari query pengguna (§4.3) | user buka jam yang belum ada |
| 2 | jam baru tutup, dari sync | operasi normal |
| 3 | backfill minggu berjalan | job latar, boleh lambat |

**Tracking-nya harus terlihat.** Tabel `tbl_t_datalog_serving_manifest` sudah
menyimpan state per generation (`building|ready|failed|superseded`) —
yang kurang cuma cara melihatnya. Minimal satu endpoint read-only yang
melaporkan, per distrik: jam yang `ready`, jam yang hilang di dalam window,
jam yang `failed` beserta alasannya, dan generation yang sedang `building`.
Tanpa ini, "tanpa fallback" berarti kegagalan materialisasi muncul ke pengguna
sebagai data hilang tanpa penjelasan.

### 4.5 Query: satu pass

`CountPointsAsync` + `ReadPreviewPointsAsync` + `CountPreviewSamplingAsync`
digabung jadi satu statement: CTE `src` sekali, window function sekali, tiga
hasil diambil dari CTE yang sama. Koneksi DuckDB dipakai ulang (di-pool), bukan
dibuat baru per statement, dan `threads` dibaca dari CPU limit pod alih-alih
di-hardcode `2` (`DuckDbSourceReader.cs:41`).

`QUALIFY` dedup dihapus dari jalur query — produk serving sudah dedup di titik
tulis (§4.2), jadi mengulangnya di titik baca hanya membayar window function
atas jutaan baris untuk hasil yang dijamin tidak berubah.

### 4.6 Alur akhir

```
producer  →  s3://…/dataloguploader/{distrik}/{device}/{tanggal}/{jam}.txt.gz
                     (kebenaran/audit — TIDAK dibaca aplikasi lagi)
                                  │
                   DatalogS3SyncService (sudah ada)
                                  │  event: jam tutup
                                  ▼
                   DatalogServingMaterializer  ── on-demand ──┐
                     dedup by rowid                            │ (prioritas 1)
                     sentinel → NULL                           │
                     sort (deviceid, heartbeat)                │
                                  │                            │
                                  ▼                            │
        s3://…/datalog-serving/v2/district=…/date=…/hour=…     │
        1 objek/distrik-jam, passthrough penuh, ZSTD           │
                                  │                            │
                    ┌─────────────┴──────────────┐             │
                    ▼                            ▼             │
              PlaybackV2                  DatalogRecord V2     │
              (1 pass, sub-detik) ────────────────────────────-┘
                    │
              Arrow IPC → worker → deck.gl   (sudah benar, tidak berubah)
```

---

## 5. Rencana kerja

Urutannya mengikuti satu prinsip: **buktikan dulu bahwa jalur generation memang
cepat pada data nyata, baru bangun otomatisasinya.**

### Fase 1 — Pembuktian (setengah hari kerja + ~2 jam waktu tunggu)

Sebelum menyentuh kode aplikasi: materialisasi manual satu hari penuh BRCB
dengan aturan §4.2 yang benar (dedup `rowid`, sentinel `NULL`, sort
`(deviceid, heartbeat)`, batch 30 file per part), lalu jalankan bentuk query
preview yang sebenarnya atas rentang 2 jam / semua unit.

**Anggaran waktunya sudah terukur, bukan ditebak** (§1f): satu jam BRCB =
198 detik. Satu hari BRCB = 24 × itu ≈ **80 menit**, plus upload 24 × 42,5 MB
≈ 1 GB pada ~0,9 MB/s ≈ **19 menit**. **Total ~1,7 jam**, serial, dari laptop
ini. Dengan concurrency 3 turun ke ~50–60 menit (dibatasi plafon link, bukan
CPU). Kalau dijalankan dari dalam cluster, perkiraan ~20–30 menit — dan
mengukur selisihnya adalah salah satu tujuan fase ini.

Yang harus dicatat: waktu materialisasi per jam-distrik, ukuran objek hasil,
waktu query preview 2 jam semua unit, dan jumlah baris hasil dedup dibanding
raw. Angka §1e (0,20 detik) baru mengukur `count + min/max` atas generation
lama yang dedup-nya salah dan sentinelnya masih bocor — belum bentuk query
produksi, belum aturan dedup yang benar.

Kalau angka di sini tidak mendekati sub-detik, sisa rencana ini harus ditinjau
ulang sebelum dikerjakan, bukan dilanjutkan.

### Fase 2 — Materializer jadi benar (~2 hari)

`DatalogServingMaterializer`, sesuai §4.2 dan §4.4:

- kunci dedup `rowid` + tie-break `source_row_no`; hapus dedup berbasis
  `timestampiso` + `ORDER BY latitude`
- `preserve_insertion_order=true` khusus di jalur materialisasi (jalur baca
  boleh tetap `false`)
- normalisasi sentinel `-9999`/`-8888` → `NULL`
- sort `(deviceid, heartbeat)`, `ROW_GROUP_SIZE` eksplisit, `ZSTD`
- hapus filter `UnitNo.StartsWith("DT")`, dan ganti bentuknya jadi batch 30 file
  per part (§4.4) — tanpa batching penghapusan filter itu berujung OOM, bukan
  cuma lambat
- validasi objek di depan (`SizeBytes > 0` + cek gzip paralel); buang loop retry
  berbasis regex di baris 113-132 (§3.6)
- syarat jam tutup + trigger dari sync + concurrency 3–4 + backoff
- prefix baru `datalog-serving/v2/` (schema fingerprint berubah; generation v1
  yang lama otomatis tidak dipakai dan bisa dihapus — termasuk 27 duplikat
  jam 19 di §3.4, ~1 GB)

### Fase 3 — Serving tanpa fallback (~1 hari)

`PlaybackV2Service.ResolveFilesAsync` hanya membaca manifest; jalur raw
dihapus dari service ini. Jam yang belum `ready` → enqueue prioritas 1 +
state `queued` dengan progress materialisasi (§4.3). `DatalogV2Service`
mengikuti jalur yang sama.

Ini menghapus bug korektnes §3.4 sebagai konsekuensi, bukan sebagai perbaikan
terpisah — tidak ada lagi kode yang mencampur generation dan raw.

### Fase 4 — Satu pass + koneksi dipakai ulang (~1 hari)

§4.5. Dikerjakan setelah Fase 3, bukan sebelumnya: begitu sumbernya satu objek
Parquet, tiga pass itu biayanya sudah kecil, jadi menggabungkannya jadi
pekerjaan rapi-rapi, bukan pekerjaan darurat. (Kalau Fase 2–3 ternyata molor,
fase ini bisa dimajukan — ia memberi 3× bahkan di jalur raw dan tidak
bergantung pada fase mana pun.)

### Fase 5 — Backfill minggu berjalan + panel tracking (~1 hari)

Job backfill prioritas 3 dengan cakupan Senin-sampai-sekarang (§4.4), plus
endpoint read-only status manifest. Keduanya prasyarat untuk menyalakan
"tanpa fallback" di produksi: tanpa backfill setiap jam lama bayar
materialisasi on-demand, tanpa panel status kegagalan tidak terlihat.

### Kemudian — ubah producer (belum dijadwalkan)

Materializer adalah kompensasi untuk producer yang menulis format dan
granularitas yang salah. Kalau producer menulis Parquet per-distrik-jam
langsung, Fase 2, 4, dan 5 hilang seluruhnya.

Sinyal bahwa ini feasible: di S3 sudah ada Parquet 18-kolom (`UnitNo`,
`Timestamp`, `Latitude`, `Longitude`, `SpeedKph`, `PlmStatus`, `Payload`,
`EngineRpm`, `Hm`, …) yang ditulis **berdampingan dengan setiap `.txt.gz`** oleh
pipeline lain — jadi penulis Parquet sudah ada di organisasi, yang kurang hanya
granularitas partisinya.

Diajukan **setelah** Fase 1–5 jalan dan angkanya terkumpul, bukan sebelumnya:
permintaan perubahan ke tim lain jauh lebih kuat kalau dibawakan bersama bukti
"arsitektur ini terukur N× lebih cepat di produksi kami" ketimbang sebagai
proposal.

---

## 6. Opsi arsitektur yang dipertimbangkan dan ditolak

| Opsi | Putusan | Alasan |
|---|---|---|
| **DuckDB + Parquet distrik-jam** | **Dipakai** | Terukur 0,20 s untuk 442k baris × 216 kolom. Tidak ada komponen baru, tidak ada ops baru, arsitekturnya sudah setengah jadi di repo. |
| Produk "track" sempit terpisah | Tolak | Schema sumber dinamis; produk sempit jadi hutang tiap kali sensor baru masuk. Projection pushdown Parquet sudah memberi efek yang sama tanpa mengunci daftar kolom. Lihat §4.2. |
| Fallback ke `.gz` saat generation belum ada | Tolak | Sumber utama bug §3.4 (pencampuran generation + raw). Diganti materialisasi on-demand dengan progress yang terlihat — satu jalur baca, bukan dua. |
| Athena / Glue | Tolak | Latensi start 2–10 s per query bahkan untuk data kecil, plus biaya per-TB-scan. Lebih lambat dari DuckDB atas Parquet yang sudah rapi untuk beban interaktif. Masuk akal untuk SQL analitik ad-hoc, bukan playback. |
| ClickHouse | Tolak untuk sekarang | Secara teknis paling pas untuk bentuk data ini. Tapi ini komitmen operasional server baru, sementara §1e menunjukkan target performa tercapai tanpa itu. Tinjau lagi kalau nanti butuh query lintas-bulan atau agregasi ad-hoc. |
| TimescaleDB / Postgres | Tolak | ~2 GB Parquet/hari → ~700 GB/tahun di storage transaksional. Salah alat untuk replay yang immutable dan append-only. |
| Pindah region / CloudFront untuk data | Tolak | Latensi 185 ms bukan penyebab utama; jumlah objek yang penyebab. Setelah §4.1 hanya 2 objek disentuh dan 185 ms jadi tidak relevan. |
| Cache hasil query di sisi app (`DATALOG_DUCKDB_PROGRESS.md` TODO 2) | Tolak | Menyembunyikan biaya request kedua, tidak mengurangi request pertama. Generation per jam sudah menjadi cache-nya, dan cache itu dipakai bersama semua pengguna dan semua kombinasi unit. |
| Ganti Arrow ke format lain | Tolak | Bukan bottleneck. Lihat §3.7. |
| Materialisasi per-hari, bukan per-jam | Tolak | Objek ~700 MB/distrik-hari membuat granularitas invalidasi terlalu kasar dan `GetChunkAsync` (1 device × 1 jam) jadi mahal. Per-jam titik yang benar. |

---

## 7. Keputusan yang sudah diambil, dan yang masih terbuka

**Sudah diputuskan:**

| Pertanyaan | Keputusan |
|---|---|
| Ubah producer? | Ya, tapi **bukan tahap pertama**. Buktikan arsitekturnya dulu, ajukan perubahan setelah ada angka. |
| Lebar kolom produk serving? | **Passthrough penuh.** Schema dinamis, kolom baru akan terus datang. Yang dijamin cuma: tidak ada duplikat, timestamp pakai `heartbeat`. |
| Fallback ke `.gz`? | **Tidak ada.** V3 hanya melayani dari generation. |
| Cakupan backfill? | **Minggu berjalan.** |

**Masih terbuka, tapi tidak memblokir Fase 1–2:**

1. **Aplikasi produksi jalan di region yang sama dengan bucket (`ap-southeast-3`)?**
   Semua angka di dokumen ini diukur dari laptop dev (throughput 0,9 MB/s,
   latency 185 ms). Kalau pod satu region, semua jalur lebih cepat dari yang
   tertulis — rasio antar opsi tetap, karena keduanya terikat jumlah objek dan
   biaya parsing, bukan bandwidth. Perlu diketahui sebelum menetapkan target SLO
   di Fase 1.

2. **Apa yang ditampilkan ke pengguna saat jam yang diminta gagal materialisasi?**
   Tanpa fallback, `failed` berarti data tidak ada. Pilihannya: pesan eksplisit
   ("jam 14:00 tidak tersedia, sedang diperbaiki") atau retry otomatis dengan
   batas. Diputuskan saat Fase 3, setelah terlihat seberapa sering
   materialisasi benar-benar gagal di Fase 1.

3. **Berapa lama generation disimpan?** Backfill dibatasi minggu berjalan, tapi
   generation lama tidak otomatis kedaluwarsa. Perlu lifecycle rule S3 supaya
   `datalog-serving/` tidak tumbuh tanpa batas — ~1,2 GB per minggu per distrik
   pada ukuran sekarang.

---

## 8. Hubungan dengan dua dokumen sebelumnya

Ketiganya membahas keluhan berbeda yang sempat tercampur jadi satu:

| Dokumen | Keluhan | Penyebab | Status |
|---|---|---|---|
| `CYCLETIME_PLAYBACK_PERFORMANCE_RESEARCH.md` | animasi tersendat setelah Play | re-render RAF-frequency | sebagian besar sudah diperbaiki, belum diukur |
| `CYCLETIME_STACK_AUDIT_V3.md` | peta berat saat digeser; ortho lambat | `viewState` di komponen page; satu proses OS per tile | teridentifikasi, belum dikerjakan |
| **dokumen ini** | **fetch data lama sekali** | **JSON gz × 520 objek × 3 pass** | **terukur, rencana di §5** |

Ketiganya independen. Yang ini yang paling besar angkanya dan paling terisolasi
perbaikannya — tidak menyentuh satu baris pun kode frontend.

---

## 9. Hasil PoC — Parquet+S3 vs ClickHouse (diukur 2026-08-17)

Dua PoC dijalankan atas irisan data yang **persis sama**: BRCB, 2026-07-07,
jam WITA 08:00–10:00, 554 objek `.txt.gz` sumber, dari laptop dev yang sama.

### 9.1 Hasil query — bentuk `PlaybackV2Service` yang asli

| Query produksi | Raw `.gz` (sekarang) | Parquet dari S3 | Parquet dari disk lokal | **ClickHouse** |
|---|---|---|---|---|
| `CountPointsAsync` | OOM | 14,7 s | 0,10 s | **0,06 s** |
| `ReadPreviewPointsAsync` | OOM | 63,5 s | 2,50 s | **0,47 s** |
| `ProcessQueryAsync` (3 pass) | OOM | ~117 s | ~3,9 s | **~1,0 s** |
| `GetChunkAsync` (1 device, 1 jam) | — | 2,79 s | 0,04 s | **0,01 s** |
| Tab Datalog, 209 kolom, 1 device 1 jam | — | 8,53 s | — | **0,00 s** |
| Tarik semua titik 2 jam, semua unit, 10 kolom | — | — | — | **0,20 s** |
| Agregasi rata-rata per device | — | — | — | **0,05 s** |
| Query kolom dinamis dari `raw` | — | — | — | **0,07 s** |

### 9.2 Biaya `FINAL` — risiko utama ClickHouse, dan ternyata tidak ada

`ReplacingMergeTree` melakukan dedup saat merge, jadi query butuh `FINAL` untuk
jaminan. Ini satu-satunya angka yang bisa membalikkan keputusan:

| Query | tanpa `FINAL` | dengan `FINAL` |
|---|---|---|
| `CountPointsAsync` | 0,06 s | 0,31 s |
| `ReadPreviewPointsAsync` | 0,47 s | **0,33 s** |
| `GetChunkAsync` | 0,01 s | 0,02 s |

Selisih baris antara keduanya hanya **1 baris dari 1.747.718** — merge sudah
menyelesaikan hampir semua dedup sendiri. `FINAL` tidak mahal di sini karena
range sudah dipangkas partisi (`toYYYYMMDD(heartbeat)`) dan `ORDER BY`
(`distrik, deviceid, heartbeat`).

### 9.3 Memori — pembeda terbesar, bukan kecepatan

| | Memori puncak |
|---|---|
| Jalur raw `.gz` sekarang (DuckDB) | **6,6 GB → OOM-killed** |
| ClickHouse, query terberat | **197 MB** |

Jalur raw hari ini tidak sekadar lambat untuk "2 jam, semua unit" — ia
**tidak pernah selesai**. `read_json` + `union_by_name` atas 554 file menembus
`memory_limit='2GB'` DuckDB sampai RSS 6,6 GB dan dibunuh kernel:

```
Out of memory: Killed process (python3) total-vm:18586476kB, anon-rss:6603892kB
```

Di pod produksi yang ber-limit `memory: 800Mi` (§9.6), itu OOMKill hampir
seketika. Gejala yang dilaporkan sebagai "fetch data lama banget" kemungkinan
besar sebenarnya **pod restart dan query tidak pernah kembali**.

ClickHouse mengerjakan beban yang sama dalam 197 MB — muat di pod tanpa
perubahan limit apa pun untuk sisi baca.

### 9.4 Biaya ingest & penyimpanan

| | Parquet (materialisasi) | ClickHouse (ingest) |
|---|---|---|
| Waktu, 2 jam / 554 file | 936 s | 1.083 s |
| Kegagalan file | 1 (diisolasi) | 2 (dilaporkan per file) |
| On-disk hasil | 82,8 MB | 202,6 MiB |
| **Lead time data bisa diquery** | **≤ 1 jam** | **detik** |
| Kode yang dibutuhkan | materializer + manifest + backfill + panel | 1 `INSERT` per file |

Keduanya terikat link laptop (0,76 MB/s); di dalam cluster satu region
dua-duanya jauh lebih cepat. Yang tidak berubah oleh lokasi adalah **lead
time** — dan itu pain point yang sebenarnya.

Rasio kompresi ClickHouse 3,39 GiB mentah → 199,81 MiB = **17×**. Kolom
terbesar `raw` (159 MiB, 80% dari total) karena saat ini `raw` menduplikasi
kolom hot. Mengeluarkan kolom hot dari `raw` memangkas ini secara signifikan —
belum dilakukan di PoC.

Ekstrapolasi: ~2,4 GB/hari on-disk, ~216 GB untuk retensi 90 hari (sebelum
optimasi duplikasi). Butuh TTL sejak hari pertama.

### 9.5 Dedup §3.5 jadi satu baris DDL

Aturan yang diturunkan dari data di §3.5 — kunci `rowid` (= `heartbeat` +
`deviceid`), tie-break urutan baris dalam file sumber — persis semantik
`ReplacingMergeTree`:

```sql
CREATE TABLE datalog (
    distrik       LowCardinality(String),
    deviceid      LowCardinality(String),
    unitno        LowCardinality(String),
    gpslat        Nullable(Float64),
    gpslong       Nullable(Float64),
    -- ~10 kolom hot lain yang dipakai ProjectedReadSql
    heartbeat     DateTime,
    rowid         String,
    source_row_no UInt32,
    raw           JSON            -- 209 kolom dinamis, kolom baru ikut otomatis
)
ENGINE = ReplacingMergeTree(source_row_no)
ORDER BY (distrik, deviceid, heartbeat)
PARTITION BY toYYYYMMDD(heartbeat);
```

Ingest, satu statement per file:

```sql
INSERT INTO datalog SELECT
  'BRCB' AS distrik,
  CAST(json.deviceid, 'LowCardinality(String)') AS deviceid,
  ...
  toDateTime(CAST(json.heartbeat,'Int64')) AS heartbeat,
  CAST(json.rowid,'String')               AS rowid,
  toUInt32(rowNumberInAllBlocks())        AS source_row_no,
  json                                    AS raw
FROM s3('https://smartdbucket.s3.ap-southeast-3.amazonaws.com/<key>',
        '<key>','<secret>','JSONAsObject','json JSON','gzip');
```

Catatan penting: `rowNumberInAllBlocks()` hanya benar sebagai `source_row_no`
kalau **satu `INSERT` = satu file objek**, karena satu file = satu (device, jam).
Ini alasan memilih ingest per-file yang dipicu `DatalogS3SyncService` ketimbang
`S3Queue` table engine yang membaca banyak file sekaligus.

Terverifikasi jalan: kolom `raw` bisa dikueri dinamis (`raw.gpsnumsat` = 10,
`raw.fix_quality_label` = 'DGPS'), dan dedup langsung benar — 3.600 baris mentah
satu file menjadi 3.560, persis jumlah `rowid` unik yang diukur di §3.5.

### 9.6 Temuan sampingan: resource limit pod

`aws_conf/Deployment.yaml`:

```yaml
resources:
  limits:
    cpu: 300m        # 0,3 core
    memory: 800Mi
```

Sementara kode meminta `memory_limit='2GB'` + `threads=2`
(`DuckDbSourceReader.cs:11,41`) dan `memory_limit='512MB'` + `threads=4`
(`DatalogRecordService.cs:51`). Ketiganya tidak nyambung satu sama lain maupun
dengan limit container.

0,3 core juga menjelaskan selisih antara ~26 menit (ekstrapolasi laptop) dan
keluhan berjam-jam di produksi: ~7× lebih lambat dari laptop ini.

Node-nya EKS `ap-southeast-3`, satu region dengan bucket — jadi komponen
jaringan yang mendominasi angka PoC dari laptop (0,76 MB/s) hampir tidak ada di
produksi. Yang tersisa justru komponen CPU dan memori, dan keduanya dicekik.

### 9.7 Mode kerusakan objek sumber — sekarang tiga, bukan dua

| Mode | Contoh | Error | Menyebut nama file? |
|---|---|---|---|
| 0 byte | `SLS30I105` | `Input is not a GZIP stream` | ya |
| gzip terpotong | `SLS30I568` | `Failed to decode gzip stream: data error` | **tidak** (DuckDB) |
| isi bukan JSON | `SLS30I375` | `JSON object should start with '{'` | ya |

Total ~0,7% objek per jam. ClickHouse melaporkan nama file untuk semua mode
(`in file/uri smartdbucket/...`), jadi retry per-file trivial dan benar —
berbeda dari loop regex di `DatalogServingMaterializer` yang bisa menuduh file
sehat (§3.6).

### 9.8 Putusan

**Jalur S3 → ClickHouse → V3 dipilih.** Alasannya berurut menurut bobot:

1. **Lead time**: detik, bukan ≤1 jam. Ini pain point yang dinyatakan.
2. **Memori**: 197 MB vs OOM. Jalur sekarang tidak bisa menyelesaikan query
   targetnya sama sekali; ini korektnes, bukan performa.
3. **Kode berkurang**: ~640 baris dihapus (`DatalogServingMaterializer`,
   `...Worker`, `...ManifestRepository`, `DuckDbSourceReader`,
   `DatalogSourceFileRef`, tabel manifest, `ResolveFilesAsync`) ditukar dengan
   satu `INSERT` per file.
4. **Performa**: 0,47 s vs 2,5 s (Parquet lokal) vs 63,5 s (Parquet dari S3).
5. **Risiko `FINAL` terbukti nol** (§9.2).

**PoC Parquet tidak sia-sia dan tetap jadi cadangan.** Ia membuktikan cara pikir
layout-nya benar (§9.1: 3,9 s komputasi vs OOM), dan ClickHouse memakai prinsip
yang sama di dalam. Kalau nanti ClickHouse ditolak dari sisi operasional, jalur
Parquet+S3 sudah terukur dan tinggal dilanjutkan dari Fase 2.

**Yang belum diuji dan harus diuji sebelum produksi:**

- Concurrency banyak user (PoC ini single-user).
- Range lebih besar dari 2 jam (24 jam, seminggu).
- Perilaku setelah restart dengan `emptyDir` vs PVC.
- Ukuran `raw` setelah kolom hot dikeluarkan dari duplikasi.
- Versi ClickHouse yang tersedia di registry internal — PoC memakai 26.7.3.19;
  tipe `JSON` butuh versi baru.
