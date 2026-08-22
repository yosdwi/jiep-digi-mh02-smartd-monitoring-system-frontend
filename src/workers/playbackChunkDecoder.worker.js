// Decodes a PlaybackV2 chunk Arrow IPC stream off the main thread (plan todo 17).
// Runs as a module worker; input/output ArrayBuffers are transferred, not copied.
import { tableFromIPC } from 'apache-arrow';

self.onmessage = (event) => {
  const { requestId, buffer } = event.data;
  try {
    const table = tableFromIPC(new Uint8Array(buffer));
    const n = table.numRows;

    const epochCol = table.getChild('timestamp_epoch_ms');
    const latCol = table.getChild('latitude');
    const lonCol = table.getChild('longitude');
    const speedCol = table.getChild('speed');
    const vehicleSpeedCol = table.getChild('vehiclespeed');
    const plmStatusCol = table.getChild('plm_status');
    const hmCol = table.getChild('hm');
    const fuelCol = table.getChild('fuel_level_tm');
    const tonnageCol = table.getChild('act_tonnage');
    const contextCol = table.getChild('context');
    const deviceIdCol = table.getChild('deviceid');
    const unitNoCol = table.getChild('unitno');

    const epochMs = new Float64Array(n);
    const latitude = new Float64Array(n);
    const longitude = new Float64Array(n);
    const speed = new Float32Array(n);
    const vehicleSpeed = new Float32Array(n);
    const plmStatus = new Float32Array(n);
    const hm = new Float32Array(n);
    const fuelLevelTm = new Float32Array(n);
    const actTonnage = new Float32Array(n);
    const context = new Uint8Array(n);

    let visibleCount = 0;
    for (let i = 0; i < n; i++) {
      epochMs[i] = Number(epochCol.get(i));
      latitude[i] = latCol.get(i);
      longitude[i] = lonCol.get(i);
      const s = speedCol.get(i); speed[i] = s == null ? NaN : s;
      const vs = vehicleSpeedCol.get(i); vehicleSpeed[i] = vs == null ? NaN : vs;
      const ps = plmStatusCol.get(i); plmStatus[i] = ps == null ? NaN : ps;
      const hmv = hmCol.get(i); hm[i] = hmv == null ? NaN : hmv;
      const fv = fuelCol.get(i); fuelLevelTm[i] = fv == null ? NaN : fv;
      const tv = tonnageCol.get(i); actTonnage[i] = tv == null ? NaN : tv;
      const isContext = Boolean(contextCol.get(i));
      context[i] = isContext ? 1 : 0;
      if (!isContext) visibleCount += 1;
    }

    const deviceId = n > 0 ? String(deviceIdCol.get(0) ?? '') : '';
    const unitNo = n > 0 ? String(unitNoCol.get(0) ?? '') : '';

    // Build the point-object array here too (not back on the main thread) —
    // per-row object + Date/toISOString construction for a full hour chunk
    // (~thousands of rows) was previously happening synchronously on the main
    // thread right as a new chunk landed, causing a playback hitch at every
    // hour boundary. Structured-clone of the result back to main thread still
    // costs something, but it doesn't block an in-flight render the way a
    // synchronous main-thread loop does, and this loop runs in parallel with
    // whatever the main thread is doing.
    const points = new Array(n);
    for (let i = 0; i < n; i++) {
      const epoch = epochMs[i];
      points[i] = {
        deviceid: deviceId,
        unitNo,
        timestamp: new Date(epoch).toISOString(),
        timestampEpochMs: epoch,
        latitude: latitude[i],
        longitude: longitude[i],
        speed: Number.isNaN(speed[i]) ? undefined : speed[i],
        vehiclespeed: Number.isNaN(vehicleSpeed[i]) ? undefined : vehicleSpeed[i],
        plm_status: Number.isNaN(plmStatus[i]) ? undefined : plmStatus[i],
        hm: Number.isNaN(hm[i]) ? undefined : hm[i],
        fuel_level_tm: Number.isNaN(fuelLevelTm[i]) ? undefined : fuelLevelTm[i],
        act_tonnage: Number.isNaN(actTonnage[i]) ? undefined : actTonnage[i],
        context: context[i] === 1,
        preview: false,
      };
    }

    self.postMessage({
      requestId,
      ok: true,
      count: n,
      visibleCount,
      deviceId,
      unitNo,
      points,
    });
  } catch (err) {
    self.postMessage({ requestId, ok: false, error: String(err?.message || err) });
  }
};
