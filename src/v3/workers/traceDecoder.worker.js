// V3 trace decoder.
//
// Input is one hour for EVERY device in the query, as a single Arrow IPC stream
// ordered by (deviceid, wita_time), with devices identified by `device_index` --
// their position in the query's ordered device list.
//
// Output is ONE set of columnar buffers for the whole hour, plus the [start,
// count) range each device occupies within them. Rows arrive grouped by device,
// so those ranges are contiguous and cost nothing to produce.
//
// Why one buffer per hour rather than one per device: the map draws a deck.gl
// layer per buffer, and per-device buffers made that layer count devices x hours
// -- 274 layers for a 2-hour, 137-unit range, which lost the WebGL context
// outright (blank canvas), and 1644 for a 12-hour shift. Per-hour buffers make
// the layer count the hour count. The registry still exposes per-device columns
// by handing out subarray VIEWS into these buffers, so per-device recolouring
// keeps working and mutates what the layer already has on the GPU.
//
// Two rules make this fast, and both are easy to lose:
//
//  1. Never touch a Vector accessor in a loop. `vector.get(i)` costs ~2.3us/row
//     through Arrow's dispatch and null handling: 2000ms for 871k rows. Reading
//     the same data as raw typed arrays (`data[b].values`) costs 1ms. The loops
//     below therefore work per record batch, on the underlying TypedArray.
//  2. Nulls live in a separate validity bitmap, which raw `values[i]` ignores --
//     a null Float32 reads as 0, not null. plm_status is null on most rows and
//     the difference between "status 0" and "no status" changes ritase counting,
//     so every nullable column is read through its bitmap.
//
// Output columns for the hour, all transferable:
//   position  Float64Array[2n]  interleaved [lon, lat, ...] — deck.gl binary layout
//   filter    Float32Array[2n]  interleaved [tMs, speed, ...] — DataFilterExtension
//   color     Uint8Array[4n]    RGBA per sample
//   epochMs   Float64Array[n]   kept for playback interpolation
//   speed     Float32Array[n]
//   plmStatus Float32Array[n]   NaN where the source was null
//   band      Uint8Array[n]     speed-band index (Underspeed)
//
// Plus `ranges`: one entry per device present in this hour —
//   { deviceIndex, start, count, minMs, maxMs, bins }
// where bins is that device's own temporal histogram, so the registry can
// aggregate over any subset of devices.
//
// Float32 for the time filter value costs precision: epoch ms near 1.75e12 has
// ~131 ms granularity in f32. That is far below the 1 s sample cadence, so time
// brushing is unaffected. Positions stay Float64 because 1e-7 degree precision
// matters for a truck-sized object.

import { tableFromIPC } from 'apache-arrow';

const clampByte = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) || 0,
    parseInt(h.slice(2, 4), 16) || 0,
    parseInt(h.slice(4, 6), 16) || 0,
  ];
}

// Speed bands arrive as [{ min, color }] sorted ascending by min. Returns the
// index of the last band whose min is <= speed. Linear scan: bands are never
// more than a handful, and a branchy binary search on 5 entries is slower.
function bandIndex(bands, speed) {
  let idx = 0;
  for (let b = 0; b < bands.length; b++) {
    if (speed >= bands[b].min) idx = b;
    else break;
  }
  return idx;
}

/**
 * Per-record-batch raw views of one column.
 * `nulls` is null when the batch has no nulls, which lets the hot loop skip the
 * bitmap test entirely on dense columns (lat/lon/timestamp are never null here).
 */
function columnBatches(table, name) {
  const child = table.getChild(name);
  if (!child) return null;
  return child.data.map((d) => ({
    values: d.values,
    nulls: d.nullCount > 0 ? d.nullBitmap : null,
    offset: d.offset,
    length: d.length,
  }));
}

const isValid = (col, i) => {
  if (!col || !col.nulls) return true;
  const bit = col.offset + i;
  return (col.nulls[bit >> 3] >> (bit & 7)) & 1;
};

// Reads a nullable numeric cell as a number, or NaN when null/absent.
const num = (col, b, i) => {
  const batch = col && col[b];
  if (!batch) return NaN;
  return isValid(batch, i) ? batch.values[i] : NaN;
};

self.onmessage = (event) => {
  const {
    requestId,
    buffer,
    binCount = 60,
    binStartMs = 0,
    binEndMs = 0,
    colorMode = 'unit',       // 'unit' | 'speed'
    unitColors = [],          // [[r,g,b], ...] indexed by device_index
    speedBands = [],
    alpha = 190,
  } = event.data;

  try {
    const table = tableFromIPC(new Uint8Array(buffer));

    const idxCol = columnBatches(table, 'device_index');
    const epochCol = columnBatches(table, 'timestamp_epoch_ms');
    const latCol = columnBatches(table, 'latitude');
    const lonCol = columnBatches(table, 'longitude');
    const speedCol = columnBatches(table, 'speed');
    const vehicleSpeedCol = columnBatches(table, 'vehiclespeed');
    const plmCol = columnBatches(table, 'plm_status');
    // VHMS columns. Kept separate rather than folded into the render buffers:
    // they never reach the GPU, but the analytics worker and the playback
    // inspector both need them per sample.
    const hmCol = columnBatches(table, 'hm');
    const fuelCol = columnBatches(table, 'fuel_level_tm');
    const tonnageCol = columnBatches(table, 'act_tonnage');

    if (!idxCol || !latCol || !lonCol || !epochCol) {
      throw new Error('chunk is missing required columns');
    }

    const batchCount = idxCol.length;
    const binSpan = binEndMs > binStartMs ? (binEndMs - binStartMs) / binCount : 0;
    const bandRgb = speedBands.map((b) => hexToRgb(b.color));
    const useSpeedColor = colorMode === 'speed' && bandRgb.length > 0;
    const a = clampByte(alpha);

    // Pass 1: how many samples survive, in total. Both passes apply identical
    // accept rules; a growable-array variant would allocate and copy far more
    // than this second scan costs.
    let kept = 0;
    for (let b = 0; b < batchCount; b++) {
      const lat = latCol[b].values;
      const lon = lonCol[b].values;
      const len = idxCol[b].length;
      for (let i = 0; i < len; i++) {
        const lo = lon[i];
        const la = lat[i];
        if (!(lo >= -180 && lo <= 180) || !(la >= -90 && la <= 90)) continue;
        if (lo === 0 && la === 0) continue;
        kept += 1;
      }
    }

    const position = new Float64Array(kept * 2);
    const filter = new Float32Array(kept * 2);
    const color = new Uint8Array(kept * 4);
    const epochMs = new Float64Array(kept);
    const speedArr = new Float32Array(kept);
    const plmArr = new Float32Array(kept);
    const hmArr = new Float32Array(kept);
    const fuelArr = new Float32Array(kept);
    const tonnageArr = new Float32Array(kept);
    const band = new Uint8Array(kept);

    // Pass 2: fill one flat buffer. Rows are grouped by device, so a device's
    // range is closed as soon as a different device_index appears.
    const ranges = [];
    let current = null;
    let n = 0;

    for (let b = 0; b < batchCount; b++) {
      const idx = idxCol[b].values;
      const lat = latCol[b].values;
      const lon = lonCol[b].values;
      const epoch = epochCol[b].values;
      const len = idxCol[b].length;

      for (let i = 0; i < len; i++) {
        const lo = lon[i];
        const la = lat[i];
        if (!(lo >= -180 && lo <= 180) || !(la >= -90 && la <= 90)) continue;
        if (lo === 0 && la === 0) continue;

        const deviceIndex = idx[i];
        if (current === null || current.deviceIndex !== deviceIndex) {
          const rgb = unitColors[deviceIndex] || [31, 119, 180];
          current = {
            deviceIndex,
            start: n,
            count: 0,
            minMs: Infinity,
            maxMs: -Infinity,
            bins: new Uint32Array(binCount),
            r: clampByte(rgb[0]),
            g: clampByte(rgb[1]),
            b: clampByte(rgb[2]),
          };
          ranges.push(current);
        }

        // Int64 columns surface as BigInt64Array; Number() once per kept row is
        // the only place a BigInt is touched.
        const t = Number(epoch[i]);

        let s = num(speedCol, b, i);
        if (Number.isNaN(s)) s = num(vehicleSpeedCol, b, i);
        if (Number.isNaN(s)) s = 0;

        position[n * 2] = lo;
        position[n * 2 + 1] = la;
        filter[n * 2] = t;
        filter[n * 2 + 1] = s;
        epochMs[n] = t;
        speedArr[n] = s;
        plmArr[n] = num(plmCol, b, i);
        hmArr[n] = num(hmCol, b, i);
        fuelArr[n] = num(fuelCol, b, i);
        tonnageArr[n] = num(tonnageCol, b, i);

        const bi = bandRgb.length > 0 ? bandIndex(speedBands, s) : 0;
        band[n] = bi;

        if (useSpeedColor) {
          const c = bandRgb[bi];
          color[n * 4] = c[0];
          color[n * 4 + 1] = c[1];
          color[n * 4 + 2] = c[2];
        } else {
          color[n * 4] = current.r;
          color[n * 4 + 1] = current.g;
          color[n * 4 + 2] = current.b;
        }
        color[n * 4 + 3] = a;

        if (binSpan > 0) {
          let bin = Math.floor((t - binStartMs) / binSpan);
          if (bin < 0) bin = 0;
          else if (bin >= binCount) bin = binCount - 1;
          current.bins[bin] += 1;
        }

        if (t < current.minMs) current.minMs = t;
        if (t > current.maxMs) current.maxMs = t;
        current.count += 1;
        n += 1;
      }
    }

    const transfers = [
      position.buffer, filter.buffer, color.buffer, epochMs.buffer,
      speedArr.buffer, plmArr.buffer, hmArr.buffer, fuelArr.buffer,
      tonnageArr.buffer, band.buffer,
    ];
    const outRanges = ranges.map((r) => {
      transfers.push(r.bins.buffer);
      return {
        deviceIndex: r.deviceIndex,
        start: r.start,
        count: r.count,
        minMs: r.minMs,
        maxMs: r.maxMs,
        bins: r.bins,
      };
    });

    self.postMessage(
      {
        requestId,
        ok: true,
        n,
        totalRows: table.numRows,
        ranges: outRanges,
        position,
        filter,
        color,
        epochMs,
        speed: speedArr,
        plmStatus: plmArr,
        hm: hmArr,
        fuelLevel: fuelArr,
        actTonnage: tonnageArr,
        band,
      },
      transfers,
    );
  } catch (err) {
    self.postMessage({ requestId, ok: false, error: String(err?.message || err) });
  }
};
