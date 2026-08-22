// Dummy data untuk Device Service Management — supaya UI/UX bisa dilihat penuh tanpa
// backend/Redis. Aksi start/stop/restart benar-benar mengubah status di memori + ack,
// jadi terasa seperti aslinya. Diaktifkan lewat flag MOCK di serviceMgmtApi.js.
// Matikan (VITE_SVCMGMT_MOCK=false) setelah backend siap.

const ACCESS_PASSWORD = 'managedservices911!';

const SERVICE_TEMPLATE = [
  'mh02-aggregatorgps-v4.3.9',
  'mh02-aggregatorcanbus-v4.0.7',
  'mh02-aggregatormodel-v4.3.6',
  'mh02-aggregatorvhms-v1.0.4',
  'mh02-aggregatormqtt-v1.6',
  'mh02-autohmapi-v1.0',
  'mh02-client',
  'mh02-loguploader-v2.7',
  'mh02-ntpsync-v2.0.1',
  'mh02-ftpvhms',
  'mh02-rtsp-server',
  'mh02-web',
  'node-red',
  'MariaDB',
];

const UNITS = {
  BRCB: [
    ['SLS30I471', 'DT3860'], ['SLS30I472', 'DT3861'], ['SLS30I473', 'DT3862'],
    ['SLS30I474', 'DT3863'], ['SLS30I475', 'DT3864'], ['SLS30I476', 'DT3865'],
    ['SLS30I477', 'DT3866'], ['SLS30I478', 'EX2210'], ['SLS30I479', 'EX2211'],
    ['SLS30I480', 'DT3867'], ['SLS30I481', 'DT3868'], ['SLS30I482', 'DT3869'],
  ],
  BRCG: [
    ['SLS31G201', 'DT5120'], ['SLS31G202', 'DT5121'], ['SLS31G203', 'DT5122'],
    ['SLS31G204', 'DT5123'], ['SLS31G205', 'EX3301'], ['SLS31G206', 'DT5124'],
    ['SLS31G207', 'DT5125'], ['SLS31G208', 'DT5126'], ['SLS31G209', 'DT5127'],
    ['SLS31G210', 'DT5128'],
  ],
};

function splitName(name) {
  const m = name.match(/-v\.?(\d+\.\d+(?:\.\d+){0,2})$/);
  if (m) return { name, base: name.slice(0, m.index), version: m[1] };
  return { name, base: name, version: null };
}

// Status deterministik biar stabil antar-poll (tidak acak tiap refresh).
function statusFor(di, si) {
  const h = (di * 7 + si * 13) % 23;
  if (h === 0 || h === 5) return 'STOPPED';
  if (h === 1) return 'UNKNOWN';
  if (h === 2) return 'PAUSED';
  return 'RUNNING';
}

const store = {}; // district -> [device]
const acks = {};  // reqId -> { readyAt, ack, offline }

function ensure(district) {
  if (!store[district]) {
    const list = UNITS[district] || [];
    store[district] = list.map(([deviceId, unitNo], di) => {
      const offline = di % 6 === 5;
      return {
        deviceId,
        unitNo,
        online: !offline,
        offline,
        lastEpoch: Math.floor(Date.now() / 1000) - (offline ? 4200 + di * 60 : 2 + (di % 7)),
        services: SERVICE_TEMPLATE.map((n, si) => ({
          ...splitName(n),
          status: offline ? (si % 2 === 0 ? 'STOPPED' : 'UNKNOWN') : statusFor(di, si),
        })),
      };
    });
  }
  return store[district];
}

const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

export async function verify(password) {
  await wait(200);
  return { ok: password === ACCESS_PASSWORD };
}

export async function districts() {
  await wait(120);
  return { districts: Object.keys(UNITS) };
}

export async function devices(district) {
  await wait(250);
  const now = Math.floor(Date.now() / 1000);
  const list = ensure(district).map((d) => {
    if (d.online) d.lastEpoch = now - (Math.floor(Math.random() * 6) + 2); // heartbeat segar
    const ageSeconds = now - d.lastEpoch;
    return {
      deviceId: d.deviceId,
      unitNo: d.unitNo,
      online: d.online,
      ts: new Date(d.lastEpoch * 1000).toISOString().slice(0, 19),
      epoch: d.lastEpoch,
      ageSeconds,
      services: d.services.map((s) => ({ ...s })),
    };
  });
  return { district, devices: list };
}

export async function command(district, deviceId, service, action) {
  await wait(350);
  const dev = ensure(district).find((d) => d.deviceId === deviceId);
  const svc = dev?.services.find((s) => s.name === service);
  const reqId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  if (!dev || !svc) {
    acks[reqId] = { readyAt: Date.now(), ack: { req_id: reqId, ok: false, reason: 'unknown service', status: 'NOT_FOUND', service, action } };
    return { ok: true, reqId, district, deviceId, service, action };
  }

  // Terapkan perubahan status (kalau unit online). Unit offline → ack tak pernah siap.
  if (dev.online) {
    const newStatus = action === 'stop' ? 'STOPPED' : 'RUNNING';
    svc.status = newStatus;
    acks[reqId] = {
      readyAt: Date.now() + 1300,
      ack: {
        req_id: reqId, deviceid: deviceId, service, action,
        ok: true, reason: 'ok', status: newStatus,
        received_ts: new Date().toISOString().slice(0, 19),
        done_ts: new Date(Date.now() + 1300).toISOString().slice(0, 19),
      },
    };
  } else {
    acks[reqId] = { offline: true }; // device offline: perintah "mengantri", tak ada balasan
  }
  return { ok: true, reqId, district, deviceId, service, action };
}

export async function ack(district, deviceId, reqId) {
  await wait(120);
  const a = acks[reqId];
  if (!a || a.offline) return { pending: true };
  if (Date.now() < a.readyAt) return { pending: true };
  return a.ack;
}
