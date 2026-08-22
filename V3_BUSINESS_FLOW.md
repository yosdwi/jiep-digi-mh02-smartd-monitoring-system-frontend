# V3 Business Flow

## Prinsip

V3 adalah mining fleet operations GIS. Map adalah permukaan utama; panel dan timeline adalah evidence, bukan dekorasi.

## Cycle Time

Pertanyaan bisnis: fleet bergerak lewat mana, kapan padat, dan bagaimana detail siklus satu unit.

Flow:

1. Operator memilih distrik, shift/range, loader, unit.
2. Map menampilkan dot trace semua unit.
3. Timeline mem-brush waktu tanpa refetch.
4. Panel kanan menjawab ringkasan, metrik unit, playback, layer.
5. Playback hanya untuk subset terpilih, trace penuh tetap jadi konteks.

## Underspeed

Pertanyaan bisnis: unit melambat di area/segment mana dan berapa lama.

Flow:

1. Dot trace sama dengan Cycle Time.
2. Warna titik mengikuti speed band.
3. Speed band bisa diedit oleh operator.
4. Event pelanggaran diturunkan dari run titik yang berada di bawah plan.
5. Klik event zoom ke lokasi dan membuka playback window.

## Durasi In Pit

Pertanyaan bisnis: unit masuk area mana, kapan, berapa lama, dan apa buktinya.

Flow:

1. Area operasi menjadi layer referensi.
2. Worker menghitung dwell event dari trace.
3. Map menampilkan polygon dan titik event.
4. Temporal dock menampilkan dwell timeline per unit.
5. Panel kanan menampilkan event table untuk bukti dan export.

## Area Operasi

Pertanyaan bisnis: area/segment operasional apa yang berlaku di site dan aturan apa yang melekat.

Flow:

1. Operator melihat trace dan layer konteks.
2. Operator menggambar atau mengedit polygon/segment.
3. Operator memberi atribut: nama, kategori, speed plan, status.
4. Save eksplisit. Tidak ada auto-save.

## Segment Builder Dari Dot Trace

Target flow:

1. Operator aktifkan tool `Buat Segment`.
2. Operator pilih dot trace lewat brush map atau timeline.
3. Sistem mengambil titik terpilih dari typed arrays.
4. Titik diurutkan per unit berdasarkan timestamp.
5. Sistem split otomatis jika gap waktu atau jarak melewati threshold.
6. Hasil menjadi `LineString` segment.
7. Operator edit vertex dengan `EditableGeoJsonLayer`.
8. Operator isi atribut segment.
9. Segment disimpan sebagai geometry operasional, bukan sekadar visualisasi.

Parameter awal:

- `maxTimeGapSeconds`: 120
- `maxDistanceGapMeters`: 80
- `simplifyToleranceMeters`: 2
- `minSamples`: 5

Output segment wajib menyimpan provenance:

- source fixture/API
- district
- unit list
- time window
- sampling interval
- threshold yang dipakai

## UI/UX Debt Yang Perlu Dikerjakan

- Tool strip harus terasa seperti product GIS, bukan kumpulan button generic.
- Resize handle panel harus jelas sebagai affordance.
- Layer manager perlu membedakan visibility, opacity, style, metadata.
- Timeline harus menjawab analisa waktu, bukan hanya seekbar.
- Segment Builder perlu mode review sebelum save.
