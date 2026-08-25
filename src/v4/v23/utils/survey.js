import * as XLSX from "xlsx";

export const SURVEY_ROLES = [
  ["x", "Posisi X / Longitude"],
  ["y", "Posisi Y / Latitude"],
  ["elevation", "Elevasi (informasi)"],
  ["code", "Kode / informasi"],
  ["ignore", "Abaikan"],
];

function parseDelimitedLine(line, delimiter) {
  const values = []; let current = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1; } else quoted = !quoted;
    } else if (char === delimiter && !quoted) { values.push(current.trim()); current = ""; } else current += char;
  }
  values.push(current.trim()); return values;
}

function textRows(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const first = lines[0]; const delimiter = first.includes("\t") ? "\t" : first.includes(";") ? ";" : first.includes(",") ? "," : null;
  return lines.map((line) => delimiter ? parseDelimitedLine(line, delimiter) : line.trim().split(/\s+/));
}

const numeric = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(String(value).replace(",", ".")));

function hasHeader(rows) {
  if (rows.length < 2) return false;
  const first = rows[0].map((value) => String(value).trim());
  if (first.some((value) => /^(x|y|easting|northing|longitude|latitude|lon|lat|elevasi|elevation|kode|code|label)$/i.test(value))) return true;
  const score = (row) => row.length ? row.filter(numeric).length / row.length : 0;
  const next = rows.slice(1, Math.min(6, rows.length)).reduce((sum, row) => sum + score(row), 0) / Math.max(1, Math.min(5, rows.length - 1));
  return score(first) < next - .3;
}

function autoRoles(headers, rows) {
  const roles = Array(headers.length).fill("ignore"); const used = new Set();
  headers.forEach((header, index) => {
    const key = String(header).toLowerCase();
    if (/easting|longitude|\blon\b|^x$/.test(key)) { roles[index] = "x"; used.add("x"); }
    else if (/northing|latitude|\blat\b|^y$/.test(key)) { roles[index] = "y"; used.add("y"); }
    else if (/elev|height|\bz\b/.test(key)) { roles[index] = "elevation"; used.add("elevation"); }
    else if (/code|kode|label|name|nama|type/.test(key)) { roles[index] = "code"; used.add("code"); }
  });
  const stats = headers.map((_, index) => rows.slice(0, 250).map((row) => Number(String(row[index] ?? "").replace(",", "."))).filter(Number.isFinite));
  const median = (values) => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];
  stats.forEach((values, index) => {
    if (roles[index] !== "ignore" || !values.length) return;
    const med = Math.abs(median(values));
    if (!used.has("x") && med > 100) { roles[index] = "x"; used.add("x"); }
    else if (!used.has("y") && med > 100) { roles[index] = "y"; used.add("y"); }
    else if (!used.has("elevation") && med < 10000) { roles[index] = "elevation"; used.add("elevation"); }
  });
  headers.forEach((_, index) => { if (roles[index] === "ignore" && !used.has("code")) { roles[index] = "code"; used.add("code"); } });
  return roles;
}

export async function readSurveyFile(file) {
  const extension = (file.name.split(".").pop() || "").toLowerCase();
  let rows;
  if (["xlsx", "xls"].includes(extension)) {
    const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
    rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, raw: true, defval: "", blankrows: false });
  } else rows = textRows(await file.text());
  rows = rows.filter((row) => Array.isArray(row) && row.some((value) => String(value ?? "").trim() !== ""));
  if (!rows.length) throw new Error("File tidak berisi data yang dapat dibaca.");
  const width = Math.max(...rows.map((row) => row.length));
  rows = rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ""));
  const header = hasHeader(rows);
  const headers = header ? rows[0].map((value, index) => String(value || `Kolom ${index + 1}`)) : Array.from({ length: width }, (_, index) => `Kolom ${index + 1}`);
  const body = header ? rows.slice(1) : rows;
  return { fileName: file.name, headers, rows: body, roles: autoRoles(headers, body) };
}

function utmToLngLat(easting, northing, zone = 50, northern = true) {
  const a = 6378137, e = .081819190842622, k0 = .9996, e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e)), x = easting - 500000, y = northern ? northing : northing - 10000000, m = y / k0, mu = m / (a * (1 - e * e / 4 - 3 * e ** 4 / 64 - 5 * e ** 6 / 256));
  const j1 = 3 * e1 / 2 - 27 * e1 ** 3 / 32, j2 = 21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32, j3 = 151 * e1 ** 3 / 96, j4 = 1097 * e1 ** 4 / 512, fp = mu + j1 * Math.sin(2 * mu) + j2 * Math.sin(4 * mu) + j3 * Math.sin(6 * mu) + j4 * Math.sin(8 * mu), e2 = e * e / (1 - e * e), c1 = e2 * Math.cos(fp) ** 2, t1 = Math.tan(fp) ** 2, n1 = a / Math.sqrt(1 - e * e * Math.sin(fp) ** 2), r1 = a * (1 - e * e) / (1 - e * e * Math.sin(fp) ** 2) ** 1.5, d = x / (n1 * k0);
  const lat = fp - (n1 * Math.tan(fp) / r1) * (d * d / 2 - (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * e2) * d ** 4 / 24 + (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * e2 - 3 * c1 * c1) * d ** 6 / 720), lonDelta = (d - (1 + 2 * t1 + c1) * d ** 3 / 6 + (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * e2 + 24 * t1 * t1) * d ** 5 / 120) / Math.cos(fp), lonOrigin = (zone - 1) * 6 - 180 + 3;
  return [lonOrigin + lonDelta * 180 / Math.PI, lat * 180 / Math.PI];
}

export function surveyCoordinates(rows, roles) {
  const xIndex = roles.indexOf("x"), yIndex = roles.indexOf("y");
  if (xIndex < 0 || yIndex < 0) return [];
  return rows.map((row) => {
    const x = Number(String(row[xIndex] ?? "").replace(",", ".")); const y = Number(String(row[yIndex] ?? "").replace(",", "."));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return Math.abs(x) <= 180 && Math.abs(y) <= 90 ? [x, y] : utmToLngLat(x, y, 50, true);
  }).filter((point) => point?.every(Number.isFinite));
}
