#!/usr/bin/env node
/* Writes sheet-template/*.csv from the current content, ready to import into a new Google Sheet
   (one tab per file: File → Import → Upload → "Insert new sheet(s)"). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toCSV } from './lib/csv.mjs';
import { SCHEMA, buildModel, loadRaw } from './lib/content.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const model = buildModel(loadRaw(path.join(ROOT, 'content')));
if (model.errors.length) { console.error(model.errors.join('\n')); process.exit(1); }
const name = { person: Object.fromEntries(model.people.map(p => [p.id, p.name])), project: Object.fromEntries(model.projects.map(p => [p.id, p.title])), area: Object.fromEntries(model.areas.map(a => [a.id, a.short])) };
const refKind = { areas: 'area', people: 'person', projects: 'project', advisor: 'person' };
const out = path.join(ROOT, 'sheet-template'); fs.mkdirSync(out, { recursive: true });
for (const [type, sch] of Object.entries(SCHEMA)) {
  const rows = model[type].map(r => sch.cols.map(c => {
    let v = r[c];
    if (type === 'projects' && c === 'people') v = r.people;
    if (Array.isArray(v)) return v.map(x => name[refKind[c]]?.[x] ?? x).join('; ');
    if (c === 'advisor' && v) return name.person[v] ?? v;
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    return v ?? '';
  }));
  fs.writeFileSync(path.join(out, sch.sheet + '.csv'), toCSV([sch.cols, ...rows]));
}
console.log('Wrote sheet-template/ (' + Object.values(SCHEMA).map(s => s.sheet + '.csv').join(', ') + ')');
