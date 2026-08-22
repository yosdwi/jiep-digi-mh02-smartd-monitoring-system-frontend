# Orthophoto — why it is slow, and the architecture that fixes it

Short answer: the orthophoto is slow because the system does **read-time
computation for data that never changes**. No amount of caching, CDN tuning,
bigger pods or a different frontend fixes that, because the cost is created on
every read by design.

The fix is to move the work to **write time, once per upload**, and make read
time a static file fetch. This document has the numbers, the pipeline, and the
migration.

---

## 1. What happens today

`jiep-digi-mh02-geofence-ortho-service`.

```
browser asks for tile z/x/y
        │
        ▼
OrthoController.GetOrthoTile
        │
        ▼
OrthoService.GetOrthoTileAsync            (Services/OrthoService.cs:127)
        │
        ├─ disk cache hit?  ──yes──▶ return PNG          ← the only fast path
        │
        ├─ COG present locally? ──no──▶ download whole COG from S3   (line 155)
        │
        ▼
GetCOGTileAsync                           (Services/OrthoService.cs:316)
        │
        ├─ build a gdal_translate command line
        ├─ Process.Start(...)             ← FORK AN OS PROCESS. PER TILE.
        ├─ GDAL initialises, opens the COG, reads a window, encodes a PNG
        ├─ write to a temp file
        ├─ read the temp file back
        └─ delete the temp file
```

Deployment (`aws_conf/Deployment.yaml`):

```yaml
replicas: 1
resources:
  limits:
    cpu: 300m        # 0.3 of one core
    memory: 1Gi
volumes:
  - hostPath: /usr/share/zoneinfo/Asia/Jakarta    # the ONLY volume
```

So: **no PersistentVolumeClaim.** `TileCachePath` is `/app/cache/tiles` inside
the container filesystem. Every pod restart, redeploy, eviction or node move
throws the entire tile cache away, and the next user regenerates the whole
pyramid by process-fork, one tile at a time, on 0.3 of a core. The COG itself is
also re-downloaded from S3 onto a container with 1 GiB of memory before the first
tile can be served.

---

## 2. The number that settles the argument

A district orthophoto covering roughly 10 km². Standard Web Mercator, 256 px
tiles:

| Zoom | Ground resolution | Tile covers | Tiles needed |
|---:|---:|---:|---:|
| 14 | 9.56 m/px | 2 446 m | 2 |
| 16 | 2.39 m/px | 612 m | 27 |
| 18 | 0.60 m/px | 153 m | 428 |
| 19 | 0.30 m/px | 76 m | 1 712 |
| 20 | 0.15 m/px | 38 m | 6 847 |

**Whole pyramid, z0–z20: 9 144 tiles ≈ 223 MB.**
**All three districts: ~27 000 tiles ≈ 670 MB.**

That is the entire dataset. It is small. It fits in an S3 bucket for a couple of
dollars a month, generates once in minutes with `gdal2tiles`, and serves from
CloudFront with **zero compute**.

The current architecture regenerates those same 9 144 tiles on demand, forking
9 144 GDAL processes onto 0.3 of a CPU core, and then loses them on the next pod
restart. A viewport at zoom 18 is 40–60 tiles; cold, that is 40–60 process forks
serialised onto a third of a core before anything appears.

This is why it feels heavy, and it is why it will keep feeling heavy no matter
what the frontend does.

---

## 3. The architecture

```
┌─────────────────── WRITE TIME (once per upload) ───────────────────┐
│                                                                     │
│  user uploads GeoTIFF                                               │
│        │                                                            │
│        ├─ 1. reproject to EPSG:3857    gdalwarp                     │
│        ├─ 2. convert to COG            gdal_translate -of COG       │
│        │      (already implemented — ConvertToCOGAsync)             │
│        ├─ 3. GENERATE THE PYRAMID      gdal2tiles.py --xyz -z 0-20  │
│        │      ← THIS IS THE STEP THAT DOES NOT EXIST TODAY          │
│        ├─ 4. upload tiles              aws s3 sync                  │
│        └─ 5. publish manifest row      bounds, minZoom, maxZoom     │
│                                                                     │
│  Runs as a background job. Minutes, once. Nobody is waiting on a    │
│  map while it happens.                                              │
└─────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────── READ TIME (every viewport) ─────────────────────┐
│                                                                     │
│  browser ──▶ CloudFront ──▶ S3                                      │
│                  │                                                  │
│                  └─ edge cache hit for everything after the first   │
│                     viewer in a region                              │
│                                                                     │
│  No .NET service. No GDAL. No process fork. No CPU limit.           │
│  No cold start. No ephemeral cache to lose.                         │
└─────────────────────────────────────────────────────────────────────┘
```

**The ortho service stops being on the render path.** It becomes an upload and
conversion job — which is what it is actually good at, and which is where a
1 GiB / 0.3 CPU pod is a perfectly reasonable size.

### Layout on S3

```
s3://smartdbucket/ortho/{district}/{layerId}/
    metadata.json          bounds, minZoom, maxZoom, uploadedAt, name
    {z}/{x}/{y}.png
```

Plain XYZ tiles, deliberately. It is the format `gdal2tiles --xyz` already emits,
the format deck.gl's `TileLayer` already consumes, and it needs **zero new client
code and zero new dependencies** — only a URL template change.

### Cache headers

```
Cache-Control: public, max-age=31536000, immutable
```

A year, immutable. Correct because `layerId` is in the path: a new upload gets a
new id and therefore a new URL, so a tile at a given URL is genuinely immutable
and nothing ever needs invalidating.

---

## 4. Why not the alternatives

| Option | Verdict |
|---|---|
| **Bigger pod / more replicas** | Buys a linear factor against an unbounded per-read cost, and does nothing about the cache dying on restart. Treats the symptom. |
| **Add a PersistentVolumeClaim** | Real improvement — the cache would survive restarts. But the first visitor to any uncached area still pays 40–60 process forks, and a PVC on one replica is a scaling dead end. Worth doing as a stopgap; not the architecture. |
| **Merge the ortho service into the monitor system** | Removes one network hop and keeps every real problem, then adds CPU contention with the DuckDB reads that serve playback. The hop was never the cost. |
| **PMTiles** | Genuinely nicer: the whole pyramid as one file, HTTP range requests, one object to invalidate. But it needs a client-side reader dependency, and plain XYZ needs none. Take it later if the object count becomes annoying — the write-time pipeline is identical up to the last step. |
| **titiler / rio-tiler dynamic tiler** | A well-built version of what exists now. Still read-time compute for data that never changes. Correct choice for imagery that is genuinely dynamic; wrong for three orthophotos that change a few times a year. |
| **Serve the COG directly to the browser** | Client-side COG readers exist, but they push the decode onto the same main thread that is animating the fleet. Precisely the wrong place. |

---

## 5. Migration — three steps, each independently shippable

**Step 1 — stop the bleeding (client side, already done).**
`useBasemapLayers.js` now passes the layer's real `maxZoom` and its `extent` to
`TileLayer`, so the browser no longer requests tiles outside the footprint or at
zoom levels the source does not have. Those requests previously returned uncached
404s, which meant every pan re-asked the service for the same empty tiles
forever. The negative responses also now carry a cache header
(`OrthoController.cs`).

This does not fix the architecture. It stops the pointless portion of the load.

**Step 2 — generate the pyramid at upload.**
Add one background step after the existing COG conversion:

```bash
gdal2tiles.py --xyz --zoom=0-20 --processes=4 \
              --resampling=average --webviewer=none \
              "$COG" "$OUT/$DISTRICT/$LAYER_ID"

aws s3 sync "$OUT/$DISTRICT/$LAYER_ID" \
            "s3://smartdbucket/ortho/$DISTRICT/$LAYER_ID/" \
            --cache-control "public, max-age=31536000, immutable"
```

`/api/ortho/layers` then returns a `staticTileUrl` alongside the existing
`tileUrl`. Nothing breaks: layers without a pyramid keep the old path.

**Step 3 — point the client at the static source.**
The client prefers `staticTileUrl` when present and falls back to `tileUrl`
otherwise, so the two coexist during migration and a single ortho can be moved
over and verified before the rest follow.

Once every layer has a pyramid, `GetOrthoTileAsync` and `GetCOGTileAsync` can be
deleted, and the service loses its CPU-bound read path entirely.

---

## 6. What "GIS workspace fast" actually requires

Beyond the pyramid, three things that a GIS workspace does and this application
should:

1. **Overviews all the way down.** `gdal2tiles` from z0 means zooming out is as
   cheap as zooming in. Today a zoomed-out view is the *most* expensive one,
   because it needs the widest COG windows.
2. **One immutable URL per version.** Enables the year-long cache header, and
   makes "compare this month against last month" a UI feature rather than a
   cache-invalidation problem. The version selector is already in V3's layer
   panel; the API already returns every converted layer.
3. **The client never waits on imagery.** V3's `TileLayer` has a 4 s per-tile
   timeout and `onTileError` is a no-op, so a slow or missing orthophoto degrades
   to a blank basemap while the trace, the polygons and the analytics keep
   working. Imagery is context, never a blocker.

---

## 7. Summary

| | Today | After |
|---|---|---|
| Work per tile read | fork GDAL, decode, encode | serve a static byte range |
| Compute at read time | 0.3 CPU, 1 replica | none |
| Cold viewport (z18) | 40–60 process forks | 40–60 CDN hits |
| Cache survives restart | no | n/a — nothing to cache |
| Pyramid size, 3 districts | regenerated forever | ~670 MB, generated once |
| Scales with viewers | no | yes, at the edge |
| Ortho service role | on the render path | upload and convert only |

The frontend work in V3 removes the requests that should never have been made.
Step 2 is what removes the cost of the ones that should.
