const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* All content comes from the build (content/*.json or the Google Sheet), embedded in the page. */
const { AREAS, PEOPLE, PROJECTS, PAPERS, MEDIA, PRESS, GROUPS, MEDIA_KINDS, PUBLICATIONS_URL } = JSON.parse($('#site-data').textContent);
/* Motion follows the accessibility toggle (and the OS setting); loops re-check it every frame. */
let reduce = window.IIS_A11Y ? IIS_A11Y.motionOff() : matchMedia('(prefers-reduced-motion: reduce)').matches;
/* word → what the page does when the hero keyboard decodes it */
const WORDS = {
  projects: { go: 'projects' }, people: { go: 'people' }, papers: { go: 'papers' }, press: { go: 'press' },
  ...Object.fromEntries(AREAS.map(a => [a.word, { lens: a.id }])),
  reset: { lens: null }
};
const MEDIA_LABEL = MEDIA_KINDS;
const areaById = Object.fromEntries(AREAS.map(a => [a.id, a]));
const personById = Object.fromEntries(PEOPLE.map(p => [p.id, p]));
const paperById = Object.fromEntries(PAPERS.map(p => [p.id, p]));
const initials = n => { const w = n.split(/\s+/); return (w[0][0] + w[w.length - 1][0]).toUpperCase(); };
const dots = ids => ids.map(i => `<i class="dot" style="--c:${areaById[i].c}" title="${esc(areaById[i].name)}"></i>`).join('');
const state = { lens: null, pin: null, hover: null, year: 'all', awards: false, mkind: 'all', tabs: { people: 'current', papers: 'papers' } };
const mediaById = Object.fromEntries(MEDIA.map(m => [m.id, m]));
const projectById = Object.fromEntries(PROJECTS.map(p => [p.id, p]));
const isAlumni = p => p.status === 'alumni';
const avatar = (p, cls = '') => `<div class="mono-av ${cls}" aria-hidden="true">${p.photo ? `<img src="${esc(p.photo)}" alt="" loading="lazy">` : initials(p.name)}</div>`;

/* ---------- render ---------- */
function renderLenses() {
  $('#lenses').innerHTML = `<span class="lens-pill" id="pill"></span>` +
    `<button class="chip" data-lens="" aria-pressed="true">All areas</button>` +
    AREAS.map(a => `<button class="chip" data-lens="${a.id}" aria-pressed="false"><i class="dot" style="--c:${a.c}"></i>${esc(a.short)}</button>`).join('');
}
function thumbHTML(p) {
  const m = p.media; if (!m) return '';
  const poster = m.poster ? `<img src="${esc(m.poster)}" alt="" loading="lazy">` : '';
  const vid = m.kind === 'file' ? `<video data-hover muted loop playsinline preload="${m.poster ? 'none' : 'metadata'}" src="${esc(m.src)}${m.poster ? '' : '#t=0.5'}" tabindex="-1" aria-hidden="true"></video>` : '';
  return `<div class="thumb">${poster}${vid}${m.kind === 'image' ? '' : '<span class="play" aria-hidden="true"></span>'}</div>`;
}
function renderProjects() {
  $('#projectMount').innerHTML = PROJECTS.map(p => {
    const vens = p.papers.map(id => paperById[id]).sort((a, b) => b.year - a.year);
    const seen = new Set();
    const badges = vens.filter(x => !seen.has(x.vs) && seen.add(x.vs)).slice(0, 3).map(x => `<span class="badge${x.award ? ' award' : ''}">${esc(x.vs)}</span>`).join('');
    return `<article class="item project" tabindex="0" data-type="project" data-id="${p.id}" data-areas="${p.areas.join(',')}">
      ${thumbHTML(p)}
      <div class="tags">${p.areas.map(a => `<span><i class="dot" style="--c:${areaById[a].c}"></i>${esc(areaById[a].short)}</span>`).join('')}</div>
      <h3>${esc(p.title)}</h3><p>${esc(p.blurb || '')}</p>
      <div class="foot"><div class="stack" aria-label="People">${p.people.map(id => `<span class="mono-av" title="${esc(personById[id].name)}">${personById[id].photo ? `<img src="${esc(personById[id].photo)}" alt="" loading="lazy">` : initials(personById[id].name)}</span>`).join('')}</div>
      <div class="vens">${badges}</div><a class="view" href="projects/${p.id}/" aria-label="View project: ${esc(p.title)}">View project →</a></div>
    </article>`;
  }).join('');
}

/* Generic accessible tabs: arrow keys move between tabs, each tab owns a panel. */
function tabsHTML(group, items) {
  return `<div class="tabs" role="tablist" aria-label="${esc(group)}" data-tabs="${group}">` +
    items.map(([id, label, n]) => `<button class="tab" role="tab" id="tab-${group}-${id}" aria-controls="panel-${group}-${id}" aria-selected="${state.tabs[group] === id}" tabindex="${state.tabs[group] === id ? 0 : -1}" data-tab="${id}">${esc(label)}${n == null ? '' : ` <span class="n">${n}</span>`}</button>`).join('') + '</div>';
}
function panel(group, id, html) {
  return `<div role="tabpanel" id="panel-${group}-${id}" aria-labelledby="tab-${group}-${id}" tabindex="0" ${state.tabs[group] === id ? '' : 'hidden'}>${html}</div>`;
}
function showTab(group, id, focus) {
  state.tabs[group] = id;
  $$(`[data-tabs="${group}"] .tab`).forEach(b => { const on = b.dataset.tab === id; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
  $$(`[id^="panel-${group}-"]`).forEach(p => { p.hidden = p.id !== `panel-${group}-${id}`; });
  scheduleLinks();
}

function personCard(p) {
  const nProj = PROJECTS.filter(x => x.people.includes(p.id)).length;
  const nPap = PAPERS.filter(x => x.people.includes(p.id)).length;
  const meta = `<div class="meta"><span>${nProj} projects · ${nPap} papers</span><span class="end"><span class="dots">${dots(p.areas)}</span></span></div>`;
  const view = `<a class="view" href="people/${p.id}/" aria-label="View profile: ${esc(p.name)}">View profile →</a>`;
  const data = `tabindex="0" data-type="person" data-id="${p.id}" data-areas="${p.areas.join(',')}"`;
  if (p.featured) {
    return `<article class="item person lead" ${data}>
      ${avatar(p)}
      <div><h3>${esc(p.name)}</h3><p class="role">${esc(p.role)}</p></div>
      <p class="bio">${esc(p.bio)}</p>${meta}${view}</article>`;
  }
  const badge = isAlumni(p) ? '' : p.chia ? ' <span class="badge">CHIA</span>' : '';
  const now = isAlumni(p) && (p.years || p.now) ? `<p class="now">${[p.years, p.now && 'Now: ' + p.now].filter(Boolean).map(esc).join(' · ')}</p>` : '';
  return `<article class="item person" ${data}>
    <div class="row">${avatar(p)}
    <div><h3>${esc(p.name)}</h3><p class="role">${esc(p.role)}${badge}</p></div></div>
    ${now}<p class="bio">${esc(p.bio)}</p>${meta}${view}</article>`;
}
function peopleGroups(list) {
  const out = [];
  GROUPS.forEach(([g, label]) => {
    const inGroup = list.filter(p => p.group === g);
    if (!inGroup.length) return;
    out.push(`<div class="mono grouplabel">${esc(label)}</div><div class="people">${inGroup.map(personCard).join('')}</div>`);
  });
  return out.join('');
}
function renderPeople() {
  const cur = PEOPLE.filter(p => !isAlumni(p)), alu = PEOPLE.filter(isAlumni);
  $('#peopleMount').innerHTML = tabsHTML('people', [['current', 'Current', cur.length], ['alumni', 'Alumni', alu.length]]) +
    panel('people', 'current', peopleGroups(cur)) +
    panel('people', 'alumni', alu.length ? peopleGroups(alu) : '<p class="empty">Alumni will be listed here. Former members: ask the group to add you.</p>');
}

function paperCard(p) {
  const title = p.link ? `<a href="${esc(p.link)}">${esc(p.title)}</a>` : esc(p.title);
  const side = (p.award ? `<span class="badge award">${esc(p.award)}</span>` : '') + (p.book ? '<span class="badge">Book</span>' : '') + `<span class="dots">${dots(p.areas)}</span>`;
  return `<article class="item paper" tabindex="0" data-type="paper" data-id="${p.id}" data-year="${p.year}" data-award="${p.award ? 1 : 0}" data-areas="${p.areas.join(',')}">
    <div class="yr">${p.year}</div><div><h3>${title}</h3><p class="au">${esc(p.au)}</p><p class="ve">${esc(p.ve)}</p></div>
    <div class="side">${side}</div></article>`;
}
function mediaCard(m) {
  const url = m.link || m.file || '';
  const title = url ? `<a href="${esc(url)}">${esc(m.title)}</a>` : esc(m.title);
  const thumb = m.thumb ? `<div class="mthumb"><img src="${esc(m.thumb)}" alt="" loading="lazy"></div>` : '';
  const sub = [m.ve, m.year].filter(Boolean).map(esc).join(' · ');
  return `<article class="item media" tabindex="0" data-type="media" data-id="${m.id}" data-kind="${m.kind}" data-areas="${m.areas.join(',')}">${thumb}<h3>${title}</h3>${m.au ? `<p>${esc(m.au)}</p>` : ''}${sub ? `<p class="mono">${sub}</p>` : ''}
    <div class="row"><span class="badge">${esc(MEDIA_LABEL[m.kind])}</span>${m.file && m.link ? `<a href="${esc(m.file)}">Download</a>` : ''}<span class="dots">${dots(m.areas)}</span></div></article>`;
}
function renderPapers() {
  const filters = ['all', '2026', '2025', 'earlier'].map(y => `<button class="chip" data-year="${y}" aria-pressed="${y === 'all'}">${y === 'all' ? 'All years' : y === 'earlier' ? '2024 and earlier' : y}</button>`).join('') +
    `<button class="chip" id="awardBtn" aria-pressed="false">Award-recognised</button>`;
  const kinds = [...new Set(MEDIA.map(m => m.kind))];
  const mfilters = kinds.length > 1 ? ['all', ...kinds].map(k => `<button class="chip" data-mkind="${k}" aria-pressed="${k === 'all'}">${k === 'all' ? 'All media' : esc(MEDIA_LABEL[k]) + 's'}</button>`).join('') : '';
  $('#paperMount').innerHTML = tabsHTML('papers', [['papers', 'Papers', PAPERS.length], ['media', 'Posters & media', MEDIA.length]]) +
    panel('papers', 'papers', `<div class="filters" id="paperFilters">${filters}</div><div class="papers">${PAPERS.map(paperCard).join('')}</div>`) +
    panel('papers', 'media', MEDIA.length ? `${mfilters ? `<div class="filters">${mfilters}</div>` : ''}<div class="medialist">${MEDIA.map(mediaCard).join('')}</div>` : '<p class="empty">Posters, talks and demo videos will appear here.</p>');
}
const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function renderPress() {
  const d0 = Date.parse('2010-06-01'), d1 = Date.parse('2013-12-01');
  let axis = '';
  [2011, 2012, 2013].forEach(y => { const t = (Date.parse(y + '-01-01') - d0) / (d1 - d0) * 100; axis += `<span class="tick" style="left:${t}%">${y}</span>`; });
  PRESS.forEach((p, i) => { const t = (Date.parse(p.date) - d0) / (d1 - d0) * 100; axis += `<button tabindex="-1" data-clip="${p.id}" style="left:${t}%;--pd:${(i * .5).toFixed(1)}s" title="${esc(p.outlet)}"></button>`; });
  $('#axis').innerHTML = axis;
  $('#pressMount').innerHTML = PRESS.map(p => {
    const dt = new Date(p.date + 'T12:00:00Z');
    return `<a class="clip" href="${p.url}" data-clip="${p.id}"><div class="src"><span class="mono">${esc(p.outlet)}</span><span class="mono">${mon[dt.getUTCMonth()]} ${dt.getUTCFullYear()}</span></div>
      <h3>${esc(p.title)}</h3><p>${esc(p.by)}</p></a>`;
  }).join('');
}

/* ---------- lens, focus, filters ---------- */
function related(type, id) {
  const r = { person: new Set(), project: new Set(), paper: new Set(), media: new Set() };
  r[type].add(id);
  if (type === 'person') {
    PROJECTS.forEach(p => p.people.includes(id) && r.project.add(p.id));
    PAPERS.forEach(p => p.people.includes(id) && r.paper.add(p.id));
    MEDIA.forEach(m => m.people.includes(id) && r.media.add(m.id));
  } else if (type === 'project') {
    const p = projectById[id]; p.people.forEach(i => r.person.add(i)); p.papers.forEach(i => r.paper.add(i));
    MEDIA.forEach(m => m.projects.includes(id) && r.media.add(m.id));
  } else if (type === 'paper') {
    const p = paperById[id]; p.people.forEach(i => r.person.add(i));
    PROJECTS.forEach(x => x.papers.includes(id) && r.project.add(x.id));
  } else {
    const m = mediaById[id]; m.people.forEach(i => r.person.add(i)); m.projects.forEach(i => r.project.add(i));
  }
  return r;
}
function apply() {
  const f = state.hover || state.pin;
  const rel = f ? related(f.type, f.id) : null;
  document.body.toggleAttribute('data-focus', !!f);
  const tally = { person: [0, 0], project: [0, 0], paper: [0, 0], media: [0, 0] };
  $$('.item').forEach(el => {
    const t = el.dataset.type, id = el.dataset.id;
    const areas = el.dataset.areas ? el.dataset.areas.split(',') : [];
    const on = !state.lens || areas.includes(state.lens);
    tally[t][1]++; if (on) tally[t][0]++;
    el.classList.toggle('is-off', !on);
    el.classList.toggle('is-focus', !!f && f.type === t && f.id === id);
    el.classList.toggle('is-rel', !!f && rel[t].has(id) && !(f.type === t && f.id === id));
    if (t === 'paper') {
      const y = +el.dataset.year;
      const showY = state.year === 'all' || (state.year === 'earlier' ? y <= 2024 : String(y) === state.year);
      el.hidden = !(showY && (!state.awards || el.dataset.award === '1'));
    }
    if (t === 'media') el.hidden = !(state.mkind === 'all' || el.dataset.kind === state.mkind);
  });
  $$('[data-lens]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.lens || null) === state.lens || (!b.dataset.lens && !state.lens))));
  $$('[data-year]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.year === state.year)));
  $$('[data-mkind]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mkind === state.mkind)));
  $('#awardBtn').setAttribute('aria-pressed', String(state.awards));
  setTally(tally); movePill(); scheduleLinks(); if (typeof lab !== 'undefined') lab.wake();
}
function setLens(id) { state.lens = id || null; apply(); }
function go(id, smooth = true) { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: reduce || !smooth ? 'auto' : 'smooth', block: 'start' }); }
function reveal(type, id) {
  const el = $(`.item[data-type="${type}"][data-id="${id}"]`); if (!el) return;
  if (type === 'paper') { state.year = 'all'; state.awards = false; showTab('papers', 'papers'); }
  if (type === 'media') { state.mkind = 'all'; showTab('papers', 'media'); }
  if (type === 'person') showTab('people', isAlumni(personById[id]) ? 'alumni' : 'current');
  state.pin = { type, id }; apply();
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}

document.addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse') return;
  const el = e.target.closest('.item'); if (el) { state.hover = { type: el.dataset.type, id: el.dataset.id }; apply(); }
  const c = e.target.closest('[data-clip]'); if (c) $$(`[data-clip="${c.dataset.clip}"]`).forEach(x => x.classList.add('on'));
});
document.addEventListener('pointerout', e => {
  if (e.pointerType !== 'mouse') return;
  const el = e.target.closest('.item');
  if (el && !el.contains(e.relatedTarget)) { state.hover = null; apply(); }
  const c = e.target.closest('[data-clip]'); if (c && !c.contains(e.relatedTarget)) $$('[data-clip]').forEach(x => x.classList.remove('on'));
});
document.addEventListener('focusin', e => {
  const el = e.target.closest('.item'); if (el) { state.hover = { type: el.dataset.type, id: el.dataset.id }; apply(); }
  const c = e.target.closest('[data-clip]'); if (c) $$(`[data-clip="${c.dataset.clip}"]`).forEach(x => x.classList.add('on'));
});
document.addEventListener('focusout', e => {
  if (e.target.closest('.item')) { state.hover = null; apply(); }
  $$('[data-clip]').forEach(x => x.classList.remove('on'));
});
document.addEventListener('click', e => {
  const lens = e.target.closest('[data-lens]'); if (lens) { setLens(lens.dataset.lens); return; }
  const yr = e.target.closest('[data-year]'); if (yr) { state.year = yr.dataset.year; apply(); return; }
  const mk = e.target.closest('[data-mkind]'); if (mk) { state.mkind = mk.dataset.mkind; apply(); return; }
  const tab = e.target.closest('.tab'); if (tab) { showTab(tab.closest('[data-tabs]').dataset.tabs, tab.dataset.tab); return; }
  if (e.target.closest('#awardBtn')) { state.awards = !state.awards; apply(); return; }
  const dot = e.target.closest('.axis [data-clip]'); if (dot) { const c = $(`.clip[data-clip="${dot.dataset.clip}"]`); c.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); c.focus(); return; }
  if (e.target.closest('a, .copy, .tab')) return;
  const el = e.target.closest('.item');
  if (el) {
    const k = { type: el.dataset.type, id: el.dataset.id };
    state.pin = state.pin && state.pin.type === k.type && state.pin.id === k.id ? null : k; apply();
  } else if (!e.target.closest('.search') && state.pin) { state.pin = null; apply(); }
  if (!e.target.closest('.search')) closeResults();
});
document.addEventListener('keydown', e => {
  if (e.key === '/' && !/input|textarea/i.test(e.target.tagName)) { e.preventDefault(); $('#q').focus(); }
  if (e.key === 'Escape') { state.pin = null; closeResults(); apply(); }
  const tabEl = e.target.closest && e.target.closest('.tab');
  if (tabEl && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
    e.preventDefault();
    const tabs = $$('.tab', tabEl.parentElement), i = tabs.indexOf(tabEl);
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    showTab(tabEl.parentElement.dataset.tabs, tabs[n].dataset.tab, true);
  }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('item') && e.target.tagName !== 'A') {
    e.preventDefault(); e.target.click();
  }
});

/* copy address */
document.addEventListener('click', e => {
  const b = e.target.closest('.copy'); if (!b) return;
  const text = b.dataset.copy, mail = b.previousElementSibling;
  const done = () => { b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy address'; }, 1800); };
  const sel = () => { const r = document.createRange(); r.selectNodeContents(mail); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'Press copy to finish'; };
  try { navigator.clipboard.writeText(text).then(done, sel); } catch (_) { sel(); }
});

/* ---------- search ---------- */
const INDEX = [
  ...['projects','people','papers','press'].map(s => ({ kind: 'section', id: s, label: s[0].toUpperCase() + s.slice(1), sub: 'Jump to section', hay: s })),
  ...AREAS.map(a => ({ kind: 'lens', id: a.id, label: a.name, sub: 'Filter everything', hay: a.name + ' ' + a.short + ' ' + a.word })),
  ...PROJECTS.map(p => ({ kind: 'project', id: p.id, label: p.title, sub: '', hay: p.title + ' ' + (p.blurb || '') })),
  ...PEOPLE.map(p => ({ kind: 'person', id: p.id, label: p.name, sub: p.role.split(' · ')[0], hay: p.name + ' ' + p.role + ' ' + p.bio + (p.chia ? ' chia' : '') + (isAlumni(p) ? ' alumni' : '') })),
  ...PAPERS.map(p => ({ kind: 'paper', id: p.id, label: p.title, sub: String(p.year), hay: p.title + ' ' + p.au + ' ' + p.ve + ' ' + p.year })),
  ...MEDIA.map(m => ({ kind: 'media', id: m.id, label: m.title, sub: MEDIA_LABEL[m.kind], hay: m.title + ' ' + (m.au || '') + ' ' + (m.ve || '') + ' ' + MEDIA_LABEL[m.kind] }))
];
const KIND = { section: 'Go to', lens: 'Area', person: 'Person', project: 'Project', paper: 'Paper', media: 'Media' };
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function subseq(q, s) { let i = 0; for (const c of s) if (c === q[i]) i++; return i === q.length; }
function search(q) {
  q = norm(q.trim()); if (!q) return [];
  const toks = q.split(/\s+/);
  return INDEX.map(it => {
    const h = norm(it.hay), l = norm(it.label);
    let s = 0;
    for (const t of toks) {
      const pos = h.indexOf(t);
      if (pos >= 0) s += 10 - Math.min(pos, 9) / 2 + (l.startsWith(t) ? 6 : 0) + (l.includes(t) ? 3 : 0) + (it.kind === 'section' || it.kind === 'person' ? 2 : 0);
      else if (t.length > 3 && subseq(t, l)) s += 2;
      else return null;
    }
    return { it, s };
  }).filter(Boolean).sort((a, b) => b.s - a.s).slice(0, 7).map(x => x.it);
}
let shown = [], sel = 0;
function showResults(list, query) {
  shown = list; sel = 0;
  const ul = $('#results');
  ul.innerHTML = list.length
    ? list.map((it, i) => `<li role="option" data-i="${i}" aria-selected="${i === 0}"><span class="t">${KIND[it.kind]}</span><span class="l">${esc(it.label)}</span>${it.sub ? `<span class="s">${esc(it.sub)}</span>` : ''}</li>`).join('')
    : `<li class="none">No match for "${esc(query)}"</li>`;
  ul.hidden = false; $('#q').setAttribute('aria-expanded', 'true');
}
function closeResults() { $('#results').hidden = true; $('#q').setAttribute('aria-expanded', 'false'); }
function choose(it) {
  if (!it) return;
  closeResults();
  if (it.kind === 'section') { state.pin = null; setLens(null); go(it.id); }
  else if (it.kind === 'lens') { setLens(it.id); go('projects'); }
  else reveal(it.kind, it.id);
}
const q = $('#q');
q.addEventListener('input', () => { const v = q.value; if (!v.trim()) { closeResults(); return; } showResults(search(v), v); });
q.addEventListener('focus', () => { if (q.value.trim()) showResults(search(q.value), q.value); });
q.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); if (!shown.length) return;
    sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length;
    $$('#results li').forEach((li, i) => li.setAttribute('aria-selected', String(i === sel)));
  } else if (e.key === 'Enter') { e.preventDefault(); choose(shown[sel]); }
  else if (e.key === 'Escape') { closeResults(); q.blur(); }
});
$('#results').addEventListener('pointerdown', e => { const li = e.target.closest('li[data-i]'); if (li) { e.preventDefault(); choose(shown[+li.dataset.i]); } });

/* ---------- gesture keyboard ---------- */
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'], OFF = [0, .5, 1.5];
const ctr = {};
ROWS.forEach((r, ri) => [...r].forEach((ch, ci) => { ctr[ch] = { x: ci + OFF[ri] + .5, y: ri + .5 }; }));
const kb = $('#kb'), trail = $('#trailg'), trailP = $('#trail'), trailH = $('#trail2');
const setTrail = d => { trailP.setAttribute('d', d); trailH.setAttribute('d', d); };
$('#keys').innerHTML = ROWS.map((r, ri) => [...r].map((ch, ci) =>
  `<g class="key" data-k="${ch}"><rect x="${ci + OFF[ri] + .06}" y="${ri + .06}" width=".88" height=".88" rx=".2"/><text x="${ci + OFF[ri] + .5}" y="${ri + .52}">${ch}</text></g>`).join('')).join('');
const pathOf = word => { const seq = [...word].filter((c, i, a) => c !== a[i - 1]); return seq.map(c => ctr[c]); };
const resample = (pts, n) => {
  let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  if (!L) return Array(n).fill(pts[0]);
  const step = L / (n - 1), out = [pts[0]]; let acc = 0, prev = pts[0];
  for (let i = 1; i < pts.length; i++) {
    let cur = pts[i], d = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    while (acc + d >= step && out.length < n) {
      const t = (step - acc) / d, nx = { x: prev.x + t * (cur.x - prev.x), y: prev.y + t * (cur.y - prev.y) };
      out.push(nx); prev = nx; d = Math.hypot(cur.x - prev.x, cur.y - prev.y); acc = 0;
    }
    acc += d; prev = cur;
  }
  while (out.length < n) out.push(pts[pts.length - 1]);
  return out;
};
const N = 48, TEMPLATES = Object.keys(WORDS).map(w => ({ w, pts: resample(pathOf(w), N), len: pathOf(w).length }));
function decode(stroke) {
  let L = 0; for (let i = 1; i < stroke.length; i++) L += Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y);
  if (L < 1.2) return [];
  const rs = resample(stroke, N);
  return TEMPLATES.map(t => {
    let d = 0; for (let i = 0; i < N; i++) d += Math.hypot(rs[i].x - t.pts[i].x, rs[i].y - t.pts[i].y);
    return { w: t.w, d: d / N };
  }).sort((a, b) => a.d - b.d).slice(0, 3);
}
function runWord(w) {
  const a = WORDS[w]; if (!a) return;
  q.value = w; state.pin = null; closeResults();
  if ('lens' in a) { setLens(a.lens); go('projects'); }
  else { setLens(null); go(a.go); }
  $('#out').textContent = '→ ' + w;
}
let pts = [], drawing = false, hitKeys = new Set(), fadeT;
const toSvg = e => { const p = kb.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const m = p.matrixTransform(kb.getScreenCTM().inverse()); return { x: m.x, y: m.y }; };
const dFrom = a => a.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(2) + ' ' + p.y.toFixed(2)).join(' ');
function keyAt(p) {
  const r = Math.floor(p.y); if (r < 0 || r > 2) return null;
  const c = Math.floor(p.x - OFF[r]); return ROWS[r][c] || null;
}
kb.addEventListener('pointerdown', e => {
  kb.setPointerCapture(e.pointerId); drawing = true; clearTimeout(fadeT);
  demo.stopped = true;
  trail.classList.remove('fade'); hitKeys.forEach(k => $(`.key[data-k="${k}"]`).classList.remove('hit')); hitKeys.clear();
  pts = [toSvg(e)]; setTrail(dFrom(pts)); $('#cands').innerHTML = ''; $('#out').textContent = '…';
});
kb.addEventListener('pointermove', e => {
  if (!drawing) return;
  const p = toSvg(e); pts.push(p); setTrail(dFrom(pts));
  const k = keyAt(p); if (k && !hitKeys.has(k)) { hitKeys.add(k); $(`.key[data-k="${k}"]`).classList.add('hit'); }
});
function endStroke() {
  if (!drawing) return; drawing = false;
  const res = decode(pts);
  const box = $('#cands');
  if (!res.length) { $('#out').textContent = 'Drag a path through the letters'; box.innerHTML = ''; }
  else {
    const best = res[0];
    if (best.d < 1.2) { runWord(best.w); box.innerHTML = res.slice(1).filter(r => r.d < 1.8).map(r => `<button class="chip" data-w="${r.w}">${r.w}</button>`).join(''); }
    else { $('#out').textContent = 'Not a command. Try one below.'; box.innerHTML = res.map((r, i) => `<button class="chip${i ? '' : ' best'}" data-w="${r.w}">${r.w}</button>`).join(''); }
  }
  fadeT = setTimeout(() => { trail.classList.add('fade'); hitKeys.forEach(k => $(`.key[data-k="${k}"]`).classList.remove('hit')); hitKeys.clear(); }, 450);
}
kb.addEventListener('pointerup', endStroke);
kb.addEventListener('pointercancel', endStroke);
$('#cands').addEventListener('click', e => { const b = e.target.closest('[data-w]'); if (b) { runWord(b.dataset.w); $('#cands').innerHTML = ''; } });
$('#try').innerHTML = Object.keys(WORDS).filter(w => w !== 'reset').map(w => `<span>${w}</span>`).join('');
$('#try').insertAdjacentHTML('afterbegin', '<span style="color:var(--ink)">Try:</span>');

/* ---------- motion: shared pointer ---------- */
const ptr = { x: -9999, y: -9999, t: -1e9 };
addEventListener('pointermove', e => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = performance.now(); }, { passive: true });

/* ---------- motion: headline letters swell near the cursor, ripple when idle ---------- */
(function title() {
  const h = $('.hero h1'), text = h.textContent.trim();
  h.setAttribute('aria-label', text);
  let n = 0;
  h.innerHTML = text.split(' ').map(w => `<span class="w" aria-hidden="true">${[...w].map(c => `<span class="ch" style="--i:${n++}">${c}</span>`).join('')}</span>`).join('');
  const chs = $$('.ch', h), cur = chs.map(() => 700), last = chs.map(() => 700);
  let vis = true, running = false;
  const kick = () => { if (!running && !reduce) { running = true; requestAnimationFrame(frame); } };
  new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis) kick(); }).observe(h);
  document.addEventListener('a11ychange', () => { if (reduce) chs.forEach((c, i) => { c.style.fontWeight = ''; cur[i] = last[i] = 700; }); kick(); });
  function frame(t) {
    if (!vis || reduce) { running = false; return; }
    const active = performance.now() - ptr.t < 2200;
    const rects = chs.map(c => c.getBoundingClientRect());
    chs.forEach((c, i) => {
      const r = rects[i], d = Math.hypot(ptr.x - (r.left + r.width / 2), ptr.y - (r.top + r.height / 2));
      const target = active ? 520 + 280 * Math.exp(-Math.pow(d / 190, 2)) : 690 + 100 * Math.sin(t / 650 - i * .5);
      cur[i] += (target - cur[i]) * .16;
      const w = Math.round(cur[i]);
      if (w !== last[i]) { c.style.fontWeight = w; last[i] = w; }
    });
    requestAnimationFrame(frame);
  }
  kick();
})();

/* ---------- motion: flow field of strokes that bends around the cursor ---------- */
(function field() {
  const zone = $('.herozone'), cv = $('#field'), ctx = cv.getContext('2d');
  let W = 0, H = 0, parts = [], vis = true, running = false, px = 0, py = 0, pvx = 0, pvy = 0;
  const kick = () => { if (!running && !reduce) { running = true; requestAnimationFrame(loop); } };
  document.addEventListener('a11ychange', () => { if (reduce) ctx.clearRect(0, 0, W, H); kick(); });
  const col = { ink: '#5b616a', acc: '#2540ff' };
  const spawn = p => { p.x = Math.random() * W; p.y = Math.random() * H; p.h = []; p.s = .5 + Math.random() * .9; p.life = 220 + Math.random() * 420; p.acc = Math.random() < .2; return p; };
  function size() {
    const r = zone.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    parts = Array.from({ length: Math.max(50, Math.min(160, Math.round(W * H / 9000))) }, () => spawn({}));
  }
  new ResizeObserver(size).observe(zone);
  new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis) kick(); }).observe(zone);
  const stroke = (h, from, to, alpha) => { ctx.globalAlpha = alpha; ctx.beginPath(); ctx.moveTo(h[from], h[from + 1]); for (let i = from + 2; i < to; i += 2) ctx.lineTo(h[i], h[i + 1]); ctx.stroke(); };
  function loop(t) {
    if (!vis || reduce) { running = false; return; }
    if (document.hidden) { requestAnimationFrame(loop); return; }
    const r = zone.getBoundingClientRect(), active = performance.now() - ptr.t < 1800;
    const mx = ptr.x - r.left, my = ptr.y - r.top;
    pvx += ((active ? mx - px : 0) - pvx) * .2; pvy += ((active ? my - py : 0) - pvy) * .2; px = mx; py = my;
    ctx.clearRect(0, 0, W, H); ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    for (const p of parts) {
      const a = Math.sin(p.x * .0042 + t * .00028) * 2.1 + Math.cos(p.y * .0051 - t * .00022) * 2.1 + Math.sin((p.x + p.y) * .0021 + t * .00015);
      let vx = Math.cos(a) * p.s, vy = Math.sin(a) * p.s;
      if (active) {
        const dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy) || 1;
        if (d < 190) { const k = 1 - d / 190; vx += (dx / d) * k * 2.2 + (-dy / d) * k * 1.6 + pvx * k * .12; vy += (dy / d) * k * 2.2 + (dx / d) * k * 1.6 + pvy * k * .12; }
      }
      p.x += vx; p.y += vy; p.h.push(p.x, p.y); if (p.h.length > 44) p.h.splice(0, 2);
      if (--p.life < 0 || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) { spawn(p); continue; }
      const h = p.h; let mid = h.length >> 1; mid -= mid % 2;
      ctx.strokeStyle = p.acc ? col.acc : col.ink;
      if (h.length >= 4) { stroke(h, 0, mid + 2, p.acc ? .16 : .08); stroke(h, mid, h.length, p.acc ? .6 : .26); }
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(loop);
  }
  kick();
})();

/* ---------- motion: keyboard demos words on its own until you touch it ---------- */
const demo = { stopped: false, live: false, vis: true, i: 0, words: ['projects', 'people', 'papers', 'press', 'access'] };
new IntersectionObserver(es => { demo.vis = es[0].isIntersecting; }).observe($('.pad'));
function playDemo() {
  if (demo.stopped) return;
  if (reduce) { demo.live = false; return; }
  demo.live = true;
  if (document.hidden || !demo.vis || drawing) { setTimeout(playDemo, 1500); return; }
  const w = demo.words[demo.i++ % demo.words.length], path = resample(pathOf(w), 100), t0 = performance.now(), dur = 1300 + w.length * 120;
  $('#out').textContent = 'e.g. ' + w; setTrail(''); trail.classList.remove('fade');
  const step = now => {
    if (demo.stopped) return;
    const p = Math.min(1, (now - t0) / dur), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const k = Math.max(1, Math.round(e * (path.length - 1)));
    setTrail(dFrom(path.slice(0, k + 1)));
    const key = keyAt(path[k]);
    if (key && !hitKeys.has(key)) { hitKeys.add(key); $(`.key[data-k="${key}"]`).classList.add('hit'); }
    if (p < 1) requestAnimationFrame(step);
    else setTimeout(() => {
      if (demo.stopped) return;
      trail.classList.add('fade'); hitKeys.forEach(k2 => $(`.key[data-k="${k2}"]`).classList.remove('hit')); hitKeys.clear();
      setTimeout(playDemo, 2200);
    }, 500);
  };
  requestAnimationFrame(step);
}

/* ---------- motion: lens pill, count-up tally ---------- */
function movePill() {
  const pill = $('#pill'), on = $('.lenses .chip[aria-pressed="true"]'), box = $('#lenses');
  if (!pill || !on) return;
  pill.style.width = on.offsetWidth + 'px';
  pill.style.transform = `translateX(${on.offsetLeft}px)`;
  if (box.scrollWidth > box.clientWidth) box.scrollTo({ left: on.offsetLeft - (box.clientWidth - on.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
}
const tallyEls = {};
function setTally(t) {
  const box = $('#tally');
  box.hidden = !state.lens;
  if (!tallyEls.ready) {
    box.innerHTML = '<b data-k="project">0</b>/<span data-t="project"></span> projects · <b data-k="person">0</b>/<span data-t="person"></span> people · <b data-k="paper">0</b>/<span data-t="paper"></span> papers';
    ['person', 'project', 'paper'].forEach(k => { tallyEls[k] = { n: $(`[data-k="${k}"]`, box), t: $(`[data-t="${k}"]`, box), raf: 0 }; });
    tallyEls.ready = true;
  }
  ['person', 'project', 'paper'].forEach(k => {
    const e = tallyEls[k], to = t[k][0], from = +e.n.textContent || 0;
    e.t.textContent = t[k][1]; cancelAnimationFrame(e.raf);
    if (reduce || from === to) { e.n.textContent = to; return; }
    const t0 = performance.now();
    const step = now => { const p = Math.min(1, (now - t0) / 500); e.n.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))); if (p < 1) e.raf = requestAnimationFrame(step); };
    e.raf = requestAnimationFrame(step);
  });
}

/* ---------- motion: staggered reveal on scroll ---------- */
function initReveal() {
  if (reduce) return;
  const io = new IntersectionObserver(es => {
    let i = 0;
    es.forEach(en => { if (en.isIntersecting) { en.target.style.setProperty('--d', (i++ * 55) + 'ms'); en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -5% 0px', threshold: .04 });
  $$('.item, .clip, .sec-head, .axis, .filters, .cta, .mapcard').forEach(el => { el.classList.add('rv'); io.observe(el); });
}

/* ---------- motion: card spotlight and tilt ---------- */
document.addEventListener('pointermove', e => {
  const el = e.target.closest && e.target.closest('.item, .clip'); if (!el) return;
  const r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  el.style.setProperty('--mx', x + 'px'); el.style.setProperty('--my', y + 'px');
  if (!reduce && e.pointerType === 'mouse' && (el.classList.contains('person') || el.classList.contains('project'))) {
    el.style.transform = `perspective(900px) rotateX(${((y / r.height) - .5) * -5}deg) rotateY(${((x / r.width) - .5) * 5}deg) translateY(-4px)`;
  }
});
document.addEventListener('pointerout', e => {
  const el = e.target.closest && e.target.closest('.item'); if (el && !el.contains(e.relatedTarget)) el.style.transform = '';
});

/* ---------- motion: live lines between related people, projects and papers ---------- */
const linksSvg = $('#links');
let lkKey = '', lkRaf = 0;
function scheduleLinks() { if (!lkRaf) lkRaf = requestAnimationFrame(drawLinks); }
addEventListener('scroll', scheduleLinks, { passive: true });
addEventListener('resize', () => { scheduleLinks(); movePill(); });
function route(a, b) {
  const ay = a.top + a.height / 2, by = b.top + b.height / 2, ax = a.left + a.width / 2, bx = b.left + b.width / 2;
  if (Math.abs(by - ay) > Math.max(a.height, b.height) * .6) {
    const dir = by > ay ? 1 : -1, x1 = ax, y1 = dir > 0 ? a.bottom : a.top, x2 = bx, y2 = dir > 0 ? b.top : b.bottom, k = Math.max(36, Math.abs(y2 - y1) * .45);
    return { d: `M${x1} ${y1}C${x1} ${y1 + dir * k} ${x2} ${y2 - dir * k} ${x2} ${y2}`, x1, y1, x2, y2 };
  }
  const dir = bx > ax ? 1 : -1, x1 = dir > 0 ? a.right : a.left, y1 = ay, x2 = dir > 0 ? b.left : b.right, y2 = by, k = Math.max(28, Math.abs(x2 - x1) * .45);
  return { d: `M${x1} ${y1}C${x1 + dir * k} ${y1} ${x2 - dir * k} ${y2} ${x2} ${y2}`, x1, y1, x2, y2 };
}
function drawLinks() {
  lkRaf = 0;
  const f = state.hover || state.pin;
  if (!f || reduce) { if (lkKey) { linksSvg.innerHTML = ''; lkKey = ''; } return; }
  const src = $(`.item[data-type="${f.type}"][data-id="${f.id}"]`); if (!src) return;
  const rel = related(f.type, f.id), VH = innerHeight, s = src.getBoundingClientRect(), list = [];
  ['person', 'project', 'paper', 'media'].forEach(t => rel[t].forEach(id => {
    if (t === f.type && id === f.id) return;
    const el = $(`.item[data-type="${t}"][data-id="${id}"]`);
    if (!el || el.hidden || el.classList.contains('is-off') || !el.offsetParent) return;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > VH) return;
    list.push({ id: t + id, r });
  }));
  const key = f.type + f.id + '|' + list.map(x => x.id).join(',');
  if (key !== lkKey) {
    lkKey = key;
    linksSvg.innerHTML = list.map(() => '<path class="enter"></path><circle r="4"></circle><circle r="4"></circle>').join('');
  }
  const ps = $$('path', linksSvg), cs = $$('circle', linksSvg);
  list.forEach((x, i) => {
    const g = route(s, x.r);
    ps[i].setAttribute('d', g.d);
    cs[i * 2].setAttribute('cx', g.x1); cs[i * 2].setAttribute('cy', g.y1);
    cs[i * 2 + 1].setAttribute('cx', g.x2); cs[i * 2 + 1].setAttribute('cy', g.y2);
  });
}

/* ---------- living map: draggable force-directed lab graph ---------- */
const lab = (() => {
  const cv = $('#mapcv'), ctx = cv.getContext('2d');
  const cs = getComputedStyle(document.documentElement);
  const tok = v => (cs.getPropertyValue(v.replace(/^var\(|\)$/g, '')) || '').trim();
  const INK = tok('--ink'), INK3 = tok('--ink-3'), ACC = tok('--accent'), LINE = tok('--line'), BG = tok('--bg');
  const FONT = getComputedStyle(document.body).fontFamily;
  const N = [], E = [], by = {};
  const add = n => { Object.assign(n, { x: 0, y: 0, vx: 0, vy: 0, ph: Math.random() * 6.28 }); N.push(n); by[n.k] = n; return n; };
  AREAS.forEach((a, i) => add({ k: 'a:' + a.id, type: 'area', id: a.id, label: a.short, full: a.name, areas: [a.id], color: tok(a.c), ang: i / AREAS.length * 6.2832 - 1.5708 }));
  add({ k: 'h:chia', type: 'hub', id: 'chia', label: 'CHIA', full: 'Centre for Human-Inspired AI', areas: [], color: INK3 });
  PROJECTS.forEach(p => add({ k: 'p:' + p.id, type: 'project', id: p.id, label: p.title, full: p.title, areas: p.areas, color: p.areas[0] ? tok(areaById[p.areas[0]].c) : INK3 }));
  PEOPLE.filter(p => !isAlumni(p)).forEach(p => add({ k: 'u:' + p.id, type: 'person', id: p.id, label: p.name, full: p.name + ' · ' + p.role, areas: p.areas, color: p.featured ? ACC : INK, ini: initials(p.name) }));
  const link = (a, b, kind) => { if (by[a] && by[b]) E.push({ a: by[a], b: by[b], kind }); };
  PROJECTS.forEach(p => { p.areas.forEach(a => link('p:' + p.id, 'a:' + a, 'pa')); p.people.forEach(u => link('u:' + u, 'p:' + p.id, 'up')); });
  PEOPLE.forEach(p => { if (p.chia) link('u:' + p.id, 'h:chia', 'grp'); });
  PEOPLE.forEach(p => { if (p.advisor) link('u:' + p.id, 'u:' + p.advisor, 'grp'); });
  const adj = {}; N.forEach(n => adj[n.k] = new Set()); E.forEach(e => { adj[e.a.k].add(e.b); adj[e.b.k].add(e.a); });

  let W = 0, H = 0, dpr = 1, S = 1, vis = false, running = false, wake = 0, hot = null, drag = null, t = 0;
  const mouse = { x: -999, y: -999, in: false };
  const R = n => (n.type === 'area' ? 25 : n.type === 'project' ? 12 : n.type === 'hub' ? 11 : 14) * S;
  const anchor = n => ({ x: W / 2 + Math.cos(n.ang) * W * .36, y: H * .44 + Math.sin(n.ang) * H * .34 });

  function layout() {
    N.forEach(n => {
      if (n.type === 'area') { const a = anchor(n); n.x = a.x; n.y = a.y; return; }
      let sx = 0, sy = 0, c = 0; adj[n.k].forEach(m => { if (m.x) { sx += m.x; sy += m.y; c++; } });
      n.x = (c ? sx / c : W / 2) + (Math.random() - .5) * 90; n.y = (c ? sy / c : H / 2) + (Math.random() - .5) * 90;
    });
  }
  function step() {
    t += 16;
    const rep = 7000 * S * S, ctr = { x: W / 2, y: H * .44 };
    for (let i = 0; i < N.length; i++) {
      const a = N[i];
      for (let j = i + 1; j < N.length; j++) {
        const b = N[j]; let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 1; const d = Math.sqrt(d2);
        let f = Math.min(rep / d2, 4); const min = R(a) + R(b) + (a.type === 'project' && b.type === 'project' ? 62 : 18) * S; if (d < min) f += (min - d) * .05;
        dx /= d; dy /= d; a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
      }
    }
    E.forEach(e => {
      const L = (e.kind === 'up' ? 100 : e.kind === 'pa' ? 140 : 120) * S, k = e.kind === 'pa' ? .006 : .012;
      const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, f = (d - L) * k;
      e.a.vx += dx / d * f; e.a.vy += dy / d * f; e.b.vx -= dx / d * f; e.b.vy -= dy / d * f;
    });
    N.forEach(n => {
      if (n === (drag && drag.n)) { n.vx = n.vy = 0; return; }
      if (n.type === 'area') { const a = anchor(n); n.vx += (a.x - n.x) * .012; n.vy += (a.y - n.y) * .012; }
      else { n.vx += (ctr.x - n.x) * .0009; n.vy += (ctr.y - n.y) * .0009; }
      if (!reduce) { n.vx += Math.sin(t * .0008 + n.ph) * .012; n.vy += Math.cos(t * .0007 + n.ph) * .012; }
      if (mouse.in && !drag) {
        const dx = n.x - mouse.x, dy = n.y - mouse.y, d = Math.sqrt(dx * dx + dy * dy) || 1, rr = 120 * S;
        if (d < rr) { const f = (1 - d / rr) * 1.1; n.vx += dx / d * f; n.vy += dy / d * f; }
      }
      n.vx *= .86; n.vy *= .86; n.x += n.vx; n.y += n.vy;
      const sm = W < 640, mx = n.type === 'area' ? 72 : R(n) + 12, my = R(n) + 12; n.x = Math.max(mx, Math.min(W - mx, n.x)); n.y = Math.max(my + (n.type === 'area' ? 4 : 0), Math.min(H - my - (n.type === 'area' ? (sm ? 96 : 56) : (sm ? 88 : 40)), n.y));
    });
  }
  const focus = () => {
    if (drag) return drag.n; if (hot) return hot;
    const p = state.pin; return p && (p.type === 'person' || p.type === 'project') ? by[(p.type === 'person' ? 'u:' : 'p:') + p.id] : null;
  };
  function lines(s, max) {
    const w = s.split(' '), out = []; let cur = '';
    w.forEach(x => { if ((cur + ' ' + x).trim().length > max && cur) { out.push(cur); cur = x; } else cur = (cur + ' ' + x).trim(); });
    if (cur) out.push(cur); return out.slice(0, 3);
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const f = focus(), lens = state.lens, small = W < 640;
    const la = n => (!lens || n.areas.includes(lens)) ? 1 : .16;
    const fa = n => !f ? 1 : (n === f || adj[f.k].has(n)) ? 1 : .12;
    E.forEach(e => {
      const on = f && (e.a === f || e.b === f);
      const al = Math.min(la(e.a), la(e.b)) * (f ? (on ? 1 : .07) : 1);
      ctx.globalAlpha = al; ctx.lineWidth = on ? 2.4 : e.kind === 'pa' ? 1.6 : 1.1;
      ctx.strokeStyle = e.kind === 'pa' ? (e.b.type === 'area' ? e.b.color : e.a.color) : on ? INK : LINE;
      ctx.setLineDash(e.kind === 'grp' ? [3, 6] : on ? [7, 6] : []); ctx.lineDashOffset = on ? -t * .04 : 0;
      ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y); ctx.stroke();
    });
    ctx.setLineDash([]);
    N.forEach(n => {
      const r = R(n) * (n === f ? 1.22 : 1); ctx.globalAlpha = la(n) * fa(n);
      if (n.type === 'area') {
        ctx.fillStyle = n.color; ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 6.2832); ctx.fill();
        ctx.globalAlpha *= .18; ctx.beginPath(); ctx.arc(n.x, n.y, r + 9 + Math.sin(t * .002 + n.ph) * 3, 0, 6.2832); ctx.fill();
        if (lens === n.id) { ctx.globalAlpha = 1; ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(n.x, n.y, r + 5, 0, 6.2832); ctx.stroke(); }
      } else if (n.type === 'project') {
        ctx.fillStyle = BG; ctx.strokeStyle = n.color; ctx.lineWidth = 3.5; rr(n.x - r, n.y - r, r * 2, r * 2, r * .42); ctx.fill(); ctx.stroke();
      } else if (n.type === 'hub') {
        ctx.fillStyle = BG; ctx.strokeStyle = INK3; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 6.2832); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      } else {
        ctx.fillStyle = n.color; ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 6.2832); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(10.5 * S * (n === f ? 1.1 : 1))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n.ini, n.x, n.y + .5);
      }
    });
    N.forEach(n => {
      const near = f && (n === f || adj[f.k].has(n)); if (n === f) return;
      const show = n.type === 'area' || n.type === 'hub' || (n.type === 'project' && (!small || near)) || (n.type === 'person' && near);
      if (!show) return;
      ctx.globalAlpha = la(n) * fa(n);
      const r = R(n), fs = n.type === 'area' ? 14 : n.type === 'project' ? 11.5 : 11.5;
      ctx.font = `${n.type === 'person' ? 600 : 700} ${Math.round(fs * Math.max(.9, S))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = n.type === 'area' ? n.color : INK;
      const ls = n.type === 'person' ? [n.label.split(' ')[0]] : lines(n.label, n.type === 'project' ? 17 : 22);
      ls.forEach((l, i) => { ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(246,247,249,.9)'; ctx.strokeText(l, n.x, n.y + r + 6 + i * 14 * S); ctx.fillText(l, n.x, n.y + r + 6 + i * 14 * S); });
    });
    ctx.globalAlpha = 1;
    if (f) {
      const s = f.full; ctx.font = `600 ${Math.round(13.5 * Math.max(.92, S))}px ${FONT}`; const w = Math.min(ctx.measureText(s).width + 26, W - 20), h = 30;
      let x = Math.max(10, Math.min(W - w - 10, f.x - w / 2)), y = f.y - R(f) * 1.22 - h - 10; if (y < 8) y = f.y + R(f) * 1.3 + 30;
      ctx.fillStyle = INK; rr(x, y, w, h, 15); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.fillText(s, x + 13, y + h / 2 + .5); ctx.restore();
    }
  }
  function loop() {
    if (!(vis && (!reduce || wake > 0 || drag))) { running = false; return; }
    step(); if (!reduce) step(); draw(); if (wake > 0) wake--; requestAnimationFrame(loop);
  }
  function kick() { if (!running && vis) { running = true; requestAnimationFrame(loop); } }
  function size() {
    const r = cv.getBoundingClientRect(); if (!r.width) return;
    const ow = W, oh = H; dpr = Math.min(devicePixelRatio || 1, 2); W = r.width; H = r.height; S = Math.max(.62, Math.min(1, W / 1050));
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    if (!ow) { layout(); for (let i = 0; i < 320; i++) step(); }
    else N.forEach(n => { n.x *= W / ow; n.y *= H / oh; });
    wake = 40; draw(); kick();
  }
  function hit(x, y) {
    let best = null, bd = 1e9;
    N.forEach(n => { const d = Math.hypot(n.x - x, n.y - y), lim = R(n) + 8; if (d < lim && d < bd) { bd = d; best = n; } });
    return best;
  }
  function pos(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  cv.addEventListener('pointermove', e => {
    const p = pos(e); mouse.x = p.x; mouse.y = p.y; mouse.in = true;
    if (drag) { if (Math.hypot(p.x - drag.sx, p.y - drag.sy) > 4) drag.moved = true; drag.n.x = p.x; drag.n.y = p.y; }
    else { hot = hit(p.x, p.y); cv.style.cursor = hot ? 'grab' : 'default'; }
    wake = 60; kick();
  });
  cv.addEventListener('pointerleave', () => { mouse.in = false; if (!drag) hot = null; wake = 30; kick(); });
  cv.addEventListener('pointerdown', e => {
    const p = pos(e), n = hit(p.x, p.y); if (!n) return;
    drag = { n, sx: p.x, sy: p.y, moved: false, id: e.pointerId }; hot = n; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; kick();
  });
  const release = e => {
    if (!drag) return; const d = drag; drag = null; cv.style.cursor = 'default'; wake = 60;
    if (e.type === 'pointerup' && !d.moved) activate(d.n); kick();
  };
  cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', release);
  function activate(n) {
    if (n.type === 'person') reveal('person', n.id);
    else if (n.type === 'project') reveal('project', n.id);
    else if (n.type === 'area') setLens(state.lens === n.id ? null : n.id);
  }
  $('#shuffle').addEventListener('click', () => {
    N.forEach(n => { const a = Math.random() * 6.2832, s = 14 + Math.random() * 18; n.vx += Math.cos(a) * s; n.vy += Math.sin(a) * s; });
    wake = 220; kick();
  });
  new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis) kick(); }, { rootMargin: '120px' }).observe(cv);
  new ResizeObserver(() => size()).observe(cv);
  return { wake: () => { wake = 40; kick(); } };
})();

/* ---------- boot ---------- */
renderLenses(); renderProjects(); renderPeople(); renderPapers(); renderPress(); apply();
initReveal();
document.addEventListener('a11ychange', () => {
  reduce = IIS_A11Y.motionOff();
  if (!reduce && !demo.stopped && !demo.live) setTimeout(playDemo, 600);
  scheduleLinks(); lab.wake();
});
if (document.fonts && document.fonts.ready) document.fonts.ready.then(movePill);
setTimeout(playDemo, 2400);
