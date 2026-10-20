#!/usr/bin/env node
/* Adds new papers to content/papers-auto.json from the ORCID records of current lab members.
   - Reads people from content/ (run scripts/sync-sheet.mjs first so this is the live sheet).
   - Asks ORCID for each member's works, then Crossref for authors and venue.
   - Only ever ADDS: papers already in the sheet, or already fetched, are left alone. To correct or remove an automatic paper, add a row for it
     in the sheet's Papers tab (same DOI or title); that row wins, and visible = FALSE hides it.
   Options: --dry-run (show what would be added, write nothing). Env: ORCID_SINCE (default: site.json "orcidSince", else 2024). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModel, loadRaw, readJSON, paperKeys, doiOf, titleKey, norm } from './lib/content.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = path.join(ROOT, 'content');
const ORCID = (process.env.ORCID_BASE || 'https://pub.orcid.org/v3.0').replace(/\/$/, '');
const CROSSREF = (process.env.CROSSREF_BASE || 'https://api.crossref.org').replace(/\/$/, '');
const DRY = process.argv.includes('--dry-run');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async (url, accept) => {
  const res = await fetch(url, { headers: { Accept: accept, 'User-Agent': 'IIS-lab-website/1.0 (paper list updater)' }, signal: AbortSignal.timeout(25000) });
  return res;
};

const raw = loadRaw(CONTENT);
const model = buildModel(raw);
if (model.errors.length) { console.error('The content has errors, so ORCID was not checked:\n' + model.errors.map(e => '  - ' + e).join('\n')); process.exit(1); }
const since = Number(process.env.ORCID_SINCE) || Number(model.site.orcidSince) || 2024;
const members = model.people.filter(p => p.orcid && p.status === 'current');
if (!members.length) { console.log('No current members have an ORCID iD in the People tab yet, so there is nothing to fetch.'); process.exit(0); }

/* Everything already known: curated papers (not the automatic ones) and anything fetched before. */
const existing = readJSON(CONTENT, 'papers-auto', []);
const known = new Set();
raw.papers.forEach(p => paperKeys(p).forEach(k => known.add(k)));
existing.forEach(p => paperKeys(p).forEach(k => known.add(k)));

/* ---- 1. ORCID: each member's works ---- */
const WANT = new Set(['journal-article', 'conference-paper', 'book', 'book-chapter', 'preprint', 'magazine-article']);
const found = new Map(); // title key -> variants
let failed = 0;
for (const m of members) {
  let res;
  try { res = await get(`${ORCID}/${m.orcid}/works`, 'application/json'); } catch (e) { console.warn(`  Could not reach ORCID for ${m.name}: ${e.message}`); failed++; continue; }
  if (!res.ok) { console.warn(`  ORCID returned ${res.status} for ${m.name} (${m.orcid}). Check the iD is right and the record's works are public.`); failed++; continue; }
  const groups = (await res.json()).group || [];
  const from = Math.max(since, m.joined || 0);
  let n = 0;
  for (const g of groups) {
    const s = (g['work-summary'] || [])[0]; if (!s) continue;
    const title = s.title && s.title.title && s.title.title.value;
    const year = Number(s['publication-date'] && s['publication-date'].year && s['publication-date'].year.value);
    const type = String(s.type || '').toLowerCase().replace(/_/g, '-');
    if (!title || !year || year < from || !WANT.has(type)) continue;
    const ids = ((g['external-ids'] || {})['external-id'] || []).concat((s['external-ids'] || {})['external-id'] || []);
    const doi = doiOf((ids.find(i => String(i['external-id-type']).toLowerCase() === 'doi') || {})['external-id-value'] || '');
    const url = (s.url && s.url.value) || '';
    const key = titleKey(title); if (!key) continue;
    if (!found.has(key)) found.set(key, []);
    found.get(key).push({ title: title.trim(), year, type, doi, url, journal: (s['journal-title'] && s['journal-title'].value) || '', who: m.id });
    n++;
  }
  console.log(`  ${m.name}: ${n} works since ${from}`);
  await sleep(250);
}
if (failed === members.length) { console.error('Could not read any ORCID record. Nothing was changed.'); process.exit(1); }

/* ---- 2. one record per paper: prefer the published version over a preprint, and note every member who has it ---- */
const candidates = [];
for (const variants of found.values()) {
  const best = variants.slice().sort((a, b) => (b.type !== 'preprint') - (a.type !== 'preprint') || (!!b.doi - !!a.doi))[0];
  candidates.push({ ...best, people: [...new Set(variants.map(v => v.who))] });
}
const fresh = [], touched = [];
for (const c of candidates) {
  const keys = paperKeys({ title: c.title, doi: c.doi, link: c.url });
  const old = existing.find(e => paperKeys(e).some(k => keys.includes(k)));
  if (old) { const merged = [...new Set([...(old.people || []), ...c.people])]; if (merged.length !== (old.people || []).length) { old.people = merged; touched.push(old.title); } continue; }
  if (keys.some(k => known.has(k))) continue; // already curated in the sheet
  fresh.push(c);
}

/* ---- 3. Crossref: authors and venue ---- */
const SHORT_VENUES = [['Transactions on Visualization and Computer Graphics', 'TVCG'], ['Transactions on Computer-Human Interaction', 'TOCHI'], ['Computing Surveys', 'CSUR'], ['Transactions on Accessible Computing', 'TACCESS'],
  ['Interactive, Mobile, Wearable and Ubiquitous Technologies', 'IMWUT'], ['International Journal of Human-Computer Studies', 'IJHCS']];
const CONFS = ['CHI', 'UIST', 'ISMAR', 'IEEE VR', 'DIS', 'SUI', 'CSCW', 'IUI', 'MobileHCI', 'ASSETS', 'TEI', 'ETRA', 'CUI', 'UbiComp', 'VRST', 'ICMI', 'CHIWORK', 'EuroVis', 'INTERACT'];
function shortVenue(container, shorts, year, acronym) {
  const c = container || '';
  const ev = String(acronym || '').match(/^([A-Za-z][A-Za-z+ ]*?)\s*['’]\d{2}$/); // Crossref gives e.g. "CHI '25"
  if (ev) return `${ev[1].trim()} ${year}`;
  for (const [needle, abbr] of SHORT_VENUES) if (c.includes(needle)) return abbr;
  for (const k of CONFS) if (new RegExp(`(^|[^A-Za-z])${k}([^A-Za-z]|$)`).test(c)) return `${k} ${year}`;
  const sh = (shorts || []).find(Boolean);
  if (sh && sh.length <= 28) return sh;
  return c.length > 28 ? c.slice(0, 27).trimEnd() + '…' : c || String(year);
}
function authors(list) {
  const names = (list || []).map(a => a.family || a.name || '').filter(Boolean);
  return names.length > 10 ? names.slice(0, 10).join(', ') + ', et al.' : names.join(', ');
}
const added = [];
for (const c of fresh) {
  let au = '', ve = c.journal, vs = '';
  if (c.doi) {
    try {
      const res = await get(`${CROSSREF}/works/${c.doi.split('/').map(encodeURIComponent).join('/')}`, 'application/json');
      if (res.ok) {
        const w = (await res.json()).message || {};
        au = authors(w.author);
        const container = (w['container-title'] || [])[0] || (w.event && w.event.name) || c.journal;
        ve = container; vs = shortVenue(container, w['short-container-title'], c.year, w.event && w.event.acronym);
      } else console.warn(`  Crossref returned ${res.status} for ${c.doi}; using ORCID details only.`);
    } catch (e) { console.warn(`  Crossref unavailable for ${c.doi} (${e.message}); using ORCID details only.`); }
    await sleep(150);
  }
  if (!vs) vs = shortVenue(ve, [], c.year);
  added.push({ title: c.title, year: c.year, au, ve, vs, link: c.doi ? `https://doi.org/${c.doi}` : c.url, doi: c.doi || undefined, people: c.people, added: new Date().toISOString().slice(0, 10) });
}

/* ---- 4. write ---- */
console.log(`\n${added.length} new paper${added.length === 1 ? '' : 's'}${touched.length ? `, ${touched.length} existing updated with more authors` : ''}.`);
for (const a of added) console.log(`  + ${a.year}  ${a.title}  [${a.people.join(', ')}]`);
const out = path.join(CONTENT, 'papers-auto.json');
if (!DRY && (added.length || touched.length)) {
  const all = existing.concat(added).sort((a, b) => b.year - a.year);
  const tidy = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''));
  fs.writeFileSync(out, JSON.stringify(all.map(tidy), null, 2) + '\n');
}
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `added=${added.length}\n`);
if (process.env.GITHUB_STEP_SUMMARY && added.length) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### New papers from ORCID\n${added.map(a => `- ${a.year} ${a.title}`).join('\n')}\n`);
