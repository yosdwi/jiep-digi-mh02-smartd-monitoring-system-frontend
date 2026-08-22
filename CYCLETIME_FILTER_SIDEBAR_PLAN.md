# Cycle Time Filter Sidebar Plan

Tujuan: mengganti modal filter Cycle Time menjadi sidebar seperti Datalog Record agar pemilihan range waktu dan unit tidak bergantung pada dropdown melayang.

## Layout

```text
Cycle Time / Filter

[Search Loader / Hauler]

Date Range
  Dari      [2026-06-23] [07:00]
  Sampai    [2026-06-23] [08:00]
  [Jam Terakhir] [12 Jam] [Hari Ini] [Kemarin]

BRCB
  Loader
    □ EX1278        (5/5)
      □ DT1201      tersedia
      □ DT1202      tersedia
      □ DT1203      tersedia
      □ DT1204      tersedia
      □ DT1205      tersedia

    □ EX1082        (4/4)
    □ EX1711        (8/8)
    □ EX2407        (2/3)

  Hauler Tanpa Loader / Unknown
    □ DT9001        tersedia

[Selected: 3 loader · 17 hauler]
[Reset] [Search]
```

## Behavior

- Root tree: `district -> loader -> hauler`.
- Checkbox loader memilih semua hauler available di bawahnya.
- Checkbox hauler memilih satu unit.
- Search mencari loader atau hauler.
- Count kanan loader memakai format `(available/total)`.
- Hauler tanpa data tetap terlihat, tapi disabled atau tidak masuk `unitNos` saat apply.
- Date range change me-refresh availability list dan mem-prune selection yang tidak available.

## Available Data

Available data harus tampil inline di list, bukan baru diketahui saat apply.

```text
□ EX2407        (2/3)
  □ DT2401      tersedia
  □ DT2402      tersedia
  ☐ DT2403      no data
```

Jika backend belum punya endpoint gabungan, FE bisa memakai endpoint availability yang sudah ada terlebih dahulu. Target akhirnya adalah satu payload tree yang sudah membawa status available per hauler untuk range waktu aktif.
