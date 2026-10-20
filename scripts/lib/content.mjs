/* Loads the content files, resolves cross-references and validates everything.
   Used by the build and by the sheet sync, so a bad edit is caught before it can reach the live site. */
import fs from 'node:fs';
import path from 'node:path';

/* Column order here is also the column order of the Google Sheet template. */
export const SCHEMA = {
  people: {
    sheet: 'People',
    cols: ['name', 'role', 'group', 'status', 'areas', 'bio', 'bioLong', 'email', 'website', 'orcid', 'joined', 'photo', 'years', 'now', 'advisor', 'chia', 'featured', 'contact', 'visible', 'id'],
    lists: ['areas'], bools: ['chia', 'featured', 'contact', 'visible'], nums: ['joined']
  },
  projects: {
    sheet: 'Projects',
    cols: ['title', 'areas', 'people', 'blurb', 'description', 'video', 'poster', 'captions', 'visible', 'id'],
    lists: ['areas', 'people'], bools: ['visible']
  },
  papers: {
    sheet: 'Papers',
    cols: ['title', 'year', 'au', 've', 'vs', 'award', 'link', 'book', 'projects', 'people', 'areas', 'visible', 'id'],
    lists: ['areas', 'people', 'projects'], bools: ['book', 'visible'], nums: ['year']
  },
  media: {
    sheet: 'Media',
    cols: ['title', 'kind', 'year', 'au', 've', 'link', 'file', 'thumb', 'projects', 'people', 'areas', 'visible', 'id'],
    lists: ['areas', 'people', 'projects'], bools: ['visible'], nums: ['year']
  },
  press: {
    sheet: 'Press',
    cols: ['title', 'outlet', 'date', 'by', 'url', 'visible', 'id'],
    lists: [], bools: ['visible']
  },
  undergrads: {
    sheet: 'Undergrads',
    cols: ['name', 'year', 'note', 'visible', 'id'],
    lists: [], bools: ['visible'], nums: ['year']
  }
};
export const GROUPS = [['PI', 'Principal investigators'], ['Postdoc', 'Postdoctoral researchers'], ['PhD', 'Doctoral students'], ['Other', 'Visitors and others']];
export const MEDIA_KINDS = { poster: 'Poster', video: 'Video', talk: 'Talk', demo: 'Demo', other: 'Other' };
const URL_FIELDS = ['website', 'photo', 'video', 'poster', 'captions', 'link', 'file', 'thumb', 'url'];

export const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
/* ORCID iDs: accept a bare id or a pasted orcid.org link, and check the ISO 7064 check digit so typos are caught. */
export function parseOrcid(v) {
  const m = String(v ?? '').toUpperCase().match(/(\d{4})-?(\d{4})-?(\d{4})-?(\d{3}[\dX])/);
  if (!m) return null;
  const digits = m.slice(1).join('');
  let total = 0; for (const c of digits.slice(0, 15)) total = (total + Number(c)) * 2;
  const check = (12 - (total % 11)) % 11, expect = check === 10 ? 'X' : String(check);
  return digits[15] === expect ? m.slice(1).join('-') : null;
}
/* How two records of the same paper are recognised: by DOI, or failing that by title. */
export const doiOf = s => { const m = String(s ?? '').match(/10\.\d{4,9}\/[^\s"<>]+/i); return m ? m[0].toLowerCase().replace(/[.,;)\]]+$/, '') : ''; };
export const titleKey = t => norm(t).replace(/[^a-z0-9]/g, '');
export const paperKeys = p => [doiOf(p.doi || p.link) && 'd:' + doiOf(p.doi || p.link), titleKey(p.title) && 't:' + titleKey(p.title)].filter(Boolean);

export const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);

/* http(s), mailto and site-relative paths only. Anything else (javascript:, data:) is rejected. */
export function safeUrl(u) {
  u = String(u ?? '').trim(); if (!u) return '';
  if (/^(https?:\/\/|mailto:)/i.test(u)) return u;
  if (/^\/\//.test(u) || /^[a-z][a-z0-9+.-]*:/i.test(u)) return null;
  return u;
}

export function readJSON(dir, name, fallback) {
  const f = path.join(dir, name + '.json');
  if (!fs.existsSync(f)) return fallback;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { throw new Error(`content/${name}.json is not valid JSON: ${e.message}`); }
}

const truthy = v => v === true || /^(true|yes|y|1|x|✓)$/i.test(String(v ?? '').trim());
const falsy = v => v === false || /^(false|no|n|0)$/i.test(String(v ?? '').trim());

function groupOf(g) {
  const s = norm(g);
  if (!s) return 'PhD';
  if (/^pi$|principal|^lead|faculty|academic|professor/.test(s)) return 'PI';
  if (/post|research (associate|fellow)/.test(s)) return 'Postdoc';
  if (/phd|doctor|student/.test(s)) return 'PhD';
  return 'Other';
}

function splitRefs(v) {
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
  return String(v ?? '').split(/[;\n]+/).map(x => x.trim()).filter(Boolean);
}

export function buildModel(raw) {
  const errors = [], warnings = [];
  const err = m => errors.push(m), warn = m => warnings.push(m);
  const site = raw.site;
  const areas = raw.areas;

  /* 1. clean rows, drop hidden ones, give everything an id */
  const hidden = { people: [], projects: [], papers: [], media: [], press: [], undergrads: [] };
  const clean = (type) => {
    const sch = SCHEMA[type], seen = new Set(), out = [];
    (raw[type] || []).forEach((r0, i) => {
      const r = {};
      for (const [k, v] of Object.entries(r0)) {
        if (typeof v === 'string') { const t = v.replace(/\r/g, '').trim(); if (t !== '') r[k] = t; }
        else if (v !== null && v !== undefined && v !== '') r[k] = v;
      }
      if (!Object.keys(r).length) return;
      const label = `${sch.sheet} row ${i + 1}${r.name || r.title ? ` ("${(r.name || r.title).slice(0, 40)}")` : ''}`;
      if ('visible' in r && falsy(r.visible)) {
        const hid = r.id || slug(r.name || r.title || '');
        if (hid) hidden[type].push({ id: hid, name: r.name, title: r.title, link: r.link, doi: r.doi });
        return;
      }
      delete r.visible;
      (sch.bools || []).forEach(k => { if (k in r) r[k] = truthy(r[k]); });
      (sch.nums || []).forEach(k => { if (k in r) { const n = parseInt(r[k], 10); if (Number.isNaN(n)) { err(`${label}: "${k}" must be a number, got "${r[k]}".`); r[k] = 0; } else r[k] = n; } });
      (sch.lists || []).forEach(k => { if (k in r) r[k] = splitRefs(r[k]); });
      URL_FIELDS.forEach(k => { if (k in r) { const s = safeUrl(r[k]); if (s === null) { err(`${label}: "${k}" must be a web address starting with http:// or https://.`); delete r[k]; } else r[k] = s; } });
      if (!r.id) {
        r.id = slug(r.name || r.title || r.outlet + ' ' + r.date);
        if (!r.id) { err(`${label}: needs a name or title.`); return; }
      }
      let id = r.id, n = 2; while (seen.has(id)) id = r.id + '-' + n++;
      r.id = id; seen.add(id); r._label = label; out.push(r);
    });
    return out;
  };
  const people = clean('people'), projects = clean('projects'), papers = clean('papers'), media = clean('media'), press = clean('press'), undergrads = clean('undergrads');

  /* 2. resolve references written as ids or as plain names/titles */
  const lookup = items => { const m = new Map(); items.forEach(x => { [x.id, x.name, x.title, x.short].forEach(k => k && m.set(norm(k), x.id)); }); return m; };
  const L = { area: lookup(areas), person: lookup(people), project: lookup(projects) };
  const LH = { area: new Map(), person: lookup(hidden.people), project: lookup(hidden.projects) };
  const ref = (kind, list, label, field) => {
    const out = [], m = L[kind];
    for (const item of list || []) {
      const hit = m.get(norm(item));
      if (hit) { out.push(hit); continue; }
      if (LH[kind].has(norm(item))) continue; // points at something hidden: leave it out quietly
      const parts = item.includes(',') ? item.split(',').map(s => s.trim()).filter(Boolean) : [];
      if (parts.length && parts.every(p => m.has(norm(p)))) { parts.forEach(p => out.push(m.get(norm(p)))); continue; }
      err(`${label}: "${item}" in "${field}" doesn't match any ${kind}. Check the spelling against the ${kind === 'area' ? 'area ids (iis, hci, acc, hc, sci)' : kind === 'person' ? 'People tab' : 'Projects tab'}.`);
    }
    return [...new Set(out)];
  };
  people.forEach(p => {
    p.areas = ref('area', p.areas, p._label, 'areas');
    if (p.advisor) p.advisor = ref('person', [p.advisor], p._label, 'advisor')[0];
  });
  projects.forEach(p => { p.areas = ref('area', p.areas, p._label, 'areas'); p.people = ref('person', p.people, p._label, 'people'); });
  for (const list of [papers, media]) list.forEach(p => {
    p.areas = ref('area', p.areas, p._label, 'areas');
    p.people = ref('person', p.people, p._label, 'people');
    p.projects = ref('project', p.projects, p._label, 'projects');
  });

  /* 3. required fields and normalisation */
  people.forEach(p => {
    if (!p.name) err(`${p._label}: needs a name.`);
    if (!p.role) warn(`${p._label}: no role set.`);
    if (p.orcid) { const o = parseOrcid(p.orcid); if (o) p.orcid = o; else { err(`${p._label}: "${p.orcid}" isn't a valid ORCID iD (it looks like 0000-0002-1825-0097).`); delete p.orcid; } }
    if (p.joined !== undefined && !(p.joined >= 1990 && p.joined <= 2100)) { err(`${p._label}: "joined" must be a year, like 2024.`); delete p.joined; }
    p.group = groupOf(p.group);
    p.status = /alum|former|past/i.test(p.status || '') ? 'alumni' : 'current';
    if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) { err(`${p._label}: "${p.email}" isn't a valid email address.`); delete p.email; }
    if (!p.bio) p.bio = '';
  });
  projects.forEach(p => { if (!p.title) err(`${p._label}: needs a title.`); if (!p.blurb) warn(`${p._label}: no blurb set.`); if (!p.areas.length) warn(`${p._label}: no research area, so it will never show under an area filter.`); });
  papers.forEach(p => {
    if (!p.title) err(`${p._label}: needs a title.`);
    if (p.year === undefined) err(`${p._label}: needs a year.`);
    p.au ||= ''; p.ve ||= '';
    p.vs ||= (p.ve.split(',')[0] || String(p.year));
  });
  media.forEach(m => {
    if (!m.title) err(`${m._label}: needs a title.`);
    m.kind = norm(m.kind || 'other'); if (!MEDIA_KINDS[m.kind]) { err(`${m._label}: kind must be one of ${Object.keys(MEDIA_KINDS).join(', ')}.`); m.kind = 'other'; }
  });
  press.forEach(p => {
    if (!p.url) err(`${p._label}: needs a url.`);
    const d = String(p.date || ''), us = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (us) p.date = `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) err(`${p._label}: date must look like 2013-08-21.`);
  });

  undergrads.forEach(u => {
    if (!u.name) err(`${u._label}: needs a name.`);
    if (u.year === undefined) err(`${u._label}: needs a year.`);
    else if (!(u.year >= 1990 && u.year <= 2100)) err(`${u._label}: year must look like 2023.`);
  });

  /* 3b. papers fetched automatically from ORCID (content/papers-auto.json). A paper in the sheet, visible or hidden, always wins,
     so editing a row in the sheet corrects an automatic paper and hiding it removes it. */
  const known = new Set(); papers.forEach(p => paperKeys(p).forEach(k => known.add(k))); hidden.papers.forEach(p => paperKeys(p).forEach(k => known.add(k)));
  const personById = Object.fromEntries(people.map(p => [p.id, p])), usedIds = new Set(papers.map(p => p.id));
  for (const a of raw.autoPapers || []) {
    if (!a || !a.title || !a.year) continue;
    const keys = paperKeys(a); if (keys.some(k => known.has(k))) continue;
    const who = (a.people || []).filter(id => personById[id]); if (!who.length) continue;
    keys.forEach(k => known.add(k));
    const link = a.link && safeUrl(a.link);
    let id = (slug(a.title).slice(0, 36) + '-' + a.year).replace(/^-/, ''), n = 2; const base = id; while (usedIds.has(id)) id = base + '-' + n++;
    usedIds.add(id);
    papers.push({ id, title: a.title, year: +a.year, au: a.au || '', ve: a.ve || '', vs: a.vs || (a.ve || '').split(',')[0] || String(a.year), ...(link ? { link } : {}),
      areas: [...new Set(who.flatMap(id => personById[id].areas))], people: who, projects: [], auto: true });
  }
  papers.sort((x, y) => y.year - x.year); // stable: the sheet's own order is kept within a year

  /* 4. derived links: a project's papers are the papers that name it */
  projects.forEach(p => { p.papers = papers.filter(x => x.projects.includes(p.id)).map(x => x.id); });
  people.forEach(p => { if (p.advisor === p.id) { err(`${p._label}: advisor can't be themselves.`); delete p.advisor; } });

  const strip = o => { delete o._label; return o; };
  people.forEach(strip); projects.forEach(strip); papers.forEach(strip); media.forEach(strip); press.forEach(strip); undergrads.forEach(strip);
  return { site, areas, people, projects, papers, media, press, undergrads, errors, warnings };
}

export function loadRaw(dir) {
  return {
    site: readJSON(dir, 'site', {}),
    areas: readJSON(dir, 'areas', []),
    people: readJSON(dir, 'people', []),
    projects: readJSON(dir, 'projects', []),
    papers: readJSON(dir, 'papers', []),
    media: readJSON(dir, 'media', []),
    press: readJSON(dir, 'press', []),
    undergrads: readJSON(dir, 'undergrads', []),
    autoPapers: readJSON(dir, 'papers-auto', [])
  };
}
