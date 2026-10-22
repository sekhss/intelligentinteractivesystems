#!/usr/bin/env node
/* Pulls the lab's Google Sheet into content/*.json.
   The sheet must be shared as "Anyone with the link" (Editor, so lab members can edit without accounts). Set SHEET_ID in the environment, or "sheetId" in content/sheet.json.
   Everything is validated first; if anything is wrong nothing is written and the previous content stays live. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSV } from './lib/csv.mjs';
import { SCHEMA, buildModel, loadRaw, slug, readJSON } from './lib/content.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = path.join(ROOT, 'content');
const cfg = readJSON(CONTENT, 'sheet', {});
const id = process.env.SHEET_ID || cfg.sheetId;
if (!id) { console.log('No SHEET_ID set: skipping sync and building from the files in content/.'); process.exit(0); }

const fail = msgs => { console.error('\nSheet sync stopped. Nothing was changed.\n' + [].concat(msgs).map(m => '  - ' + m).join('\n') + '\n'); process.exit(1); };
const timeout = () => AbortSignal.timeout(30000);

/* Optional tabs may be missing from older copies of the sheet; the rest must exist. */
const OPTIONAL = new Set(['areas', 'media', 'press', 'undergrads']);
async function fetchTab(sheetName, optional) {
  const base = (process.env.SHEET_BASE || 'https://docs.google.com').replace(/\/$/, '');
  const url = `${base}/spreadsheets/d/${encodeURIComponent(id)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  let res;
  try { res = await fetch(url, { signal: timeout() }); } catch (e) { fail(`Could not reach Google Sheets (${e.message}).`); }
  const text = await res.text();
  if (!res.ok || /^\s*<(!doctype|html)/i.test(text)) { if (optional) return null; fail(`Could not read the "${sheetName}" tab. Check the tab is named exactly "${sheetName}" and the sheet is shared as "Anyone with the link".`); }
  return text;
}

/* Google quietly returns the FIRST tab when asked for a tab that doesn't exist, so check the headings really belong to this tab. */
const KEY_COLS = { areas: ['name', 'short'], people: ['name'], projects: ['title'], papers: ['title', 'year'], media: ['title'], press: ['title', 'url'], undergrads: ['name', 'year'] };
function rowsToObjects(type, csv) {
  const sch = SCHEMA[type], rows = parseCSV(csv);
  if (!rows.length) return [];
  const head = rows[0].map(h => h.trim());
  if (!KEY_COLS[type].every(k => head.some(h => h.toLowerCase() === k))) return null;
  const idx = {}; head.forEach((h, i) => { const k = sch.cols.find(c => c.toLowerCase() === h.toLowerCase()); if (k) idx[k] = i; else if (h) console.warn(`  Note: column "${h}" in ${sch.sheet} isn't recognised and was ignored.`); });
  return rows.slice(1).map(r => {
    const o = {}; for (const [k, i] of Object.entries(idx)) { const v = (r[i] ?? '').trim(); if (v !== '') o[k] = v; }
    return o;
  }).filter(o => Object.keys(o).length);
}

/* Google Drive "share" links → direct download links. */
function direct(u) {
  const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/);
  return m ? `https://drive.google.com/uc?export=download&id=${m[1]}` : u;
}
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };
async function localise(o, field, prefix) {
  const u = o[field]; if (!u || !/^https?:\/\//i.test(u)) return;
  const name = prefix + '-' + slug(o.name || o.title || o.id || 'item');
  try {
    const res = await fetch(direct(u), { signal: timeout(), redirect: 'follow' });
    const type = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!res.ok || !EXT[type]) throw new Error(`not an image (${res.status} ${type || 'unknown type'})`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) throw new Error('larger than 8 MB');
    const dir = path.join(ROOT, 'public/img/synced'); fs.mkdirSync(dir, { recursive: true });
    const file = `${name}.${EXT[type]}`; fs.writeFileSync(path.join(dir, file), buf);
    o[field] = `img/synced/${file}`;
  } catch (e) {
    console.warn(`  Warning: couldn't fetch the ${field} for "${o.name || o.title}" (${e.message}). Check the link is public.`);
    delete o[field];
  }
}

const raw = loadRaw(CONTENT);
const fetched = {};
for (const type of Object.keys(SCHEMA)) {
  process.stdout.write(`Reading ${SCHEMA[type].sheet}… `);
  const csv = await fetchTab(SCHEMA[type].sheet, OPTIONAL.has(type));
  const rows = csv === null ? null : rowsToObjects(type, csv);
  if (rows === null) {
    if (!OPTIONAL.has(type)) fail(`The "${SCHEMA[type].sheet}" tab doesn't look right: its first row should have headings including ${KEY_COLS[type].join(', ')}.`);
    fetched[type] = []; console.log('no such tab (or no headings yet), skipped'); continue;
  }
  fetched[type] = rows;
  console.log(`${rows.length} rows`);
}
for (const t of ['people', 'projects', 'papers']) if (!fetched[t].length) fail(`The ${SCHEMA[t].sheet} tab came back empty. Refusing to publish an empty ${t} list.`);

/* No Areas tab yet: keep the areas already in content/. */
if (!fetched.areas.length) delete fetched.areas;

for (const o of fetched.people) await localise(o, 'photo', 'person');
for (const o of fetched.projects) await localise(o, 'poster', 'project');
for (const o of fetched.media) await localise(o, 'thumb', 'media');

const candidate = { ...raw, ...fetched };
const model = buildModel(candidate);
if (model.errors.length) fail(model.errors);
if (model.warnings.length) console.warn('Warnings:\n' + model.warnings.map(w => '  - ' + w).join('\n'));

for (const [type, rows] of Object.entries(fetched)) {
  fs.writeFileSync(path.join(CONTENT, type + '.json'), JSON.stringify(rows, null, 2) + '\n');
}
console.log('Content updated from the sheet.');
