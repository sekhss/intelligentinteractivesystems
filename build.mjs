#!/usr/bin/env node
/* Static site generator. `node build.mjs` reads content/*.json and writes the finished site to dist/.
   No dependencies: it needs only Node 18+. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadRaw, buildModel, GROUPS, MEDIA_KINDS } from './scripts/lib/content.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = process.env.DIST_DIR || path.join(ROOT, 'dist');
const model = buildModel(loadRaw(process.env.CONTENT_DIR || path.join(ROOT, 'content')));
const { site, areas, people, projects, papers, media, press, undergrads } = model;

/* ---------- helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = n => { const w = n.trim().split(/\s+/); return ((w[0]?.[0] || '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase(); };
const isAbs = u => /^(https?:|mailto:)/i.test(u);
const href = (root, u) => !u ? '' : isAbs(u) ? u : root + u.replace(/^\/+/, '');
const paras = t => String(t || '').split(/\n+/).map(s => s.trim()).filter(Boolean).map(s => `<p>${esc(s)}</p>`).join('');
const byId = list => Object.fromEntries(list.map(x => [x.id, x]));
const A = byId(areas), P = byId(people), PR = byId(projects), PA = byId(papers);
const siteUrl = (site.url || '').replace(/\/?$/, '/');
/* /manage is a password box that forwards to the editing sheet. It is only built when both SHEET_ID and EDIT_PASSWORD are set. */
const editPassword = process.env.EDIT_PASSWORD || '';
const sheetId = process.env.SHEET_ID || '';
const manageEnabled = !!(editPassword && sheetId);
if ((editPassword || sheetId) && !manageEnabled && editPassword) model.warnings.push('/manage was not generated: it needs both EDIT_PASSWORD and SHEET_ID.');
if (editPassword && editPassword.length < 16) model.errors.push('EDIT_PASSWORD must be at least 16 characters: it is the only thing protecting the sheet link.');
let lastUpdated = null; // { hash, date }, set just before writing
const hash = f => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex').slice(0, 8);

/* A local file named in the content must exist, otherwise drop it and warn rather than ship a broken image. */
function checkLocal(item, field, label) {
  const u = item[field]; if (!u || isAbs(u)) return;
  if (!fs.existsSync(path.join(ROOT, 'public', u))) { model.warnings.push(`${label}: file "${u}" not found in public/, so "${field}" was ignored.`); delete item[field]; }
}
people.forEach(p => { checkLocal(p, 'photo', 'People: ' + p.name); });
projects.forEach(p => { ['poster', 'captions'].forEach(f => checkLocal(p, f, 'Projects: ' + p.title)); if (p.video && !isAbs(p.video)) checkLocal(p, 'video', 'Projects: ' + p.title); });
media.forEach(m => { ['thumb', 'file'].forEach(f => checkLocal(m, f, 'Media: ' + m.title)); });

function videoInfo(url) {
  if (!url) return null; let m;
  if ((m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/))) return { kind: 'youtube', embed: `https://www.youtube-nocookie.com/embed/${m[1]}`, poster: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` };
  if ((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/))) return { kind: 'vimeo', embed: `https://player.vimeo.com/video/${m[1]}` };
  return { kind: 'file', src: url };
}
projects.forEach(p => { const v = videoInfo(p.video); if (v) { p.media = { ...v }; if (p.poster) p.media.poster = p.poster; else if (v.kind === 'file') delete p.media.poster; } else if (p.poster) p.media = { kind: 'image', poster: p.poster }; });

const dots = (ids) => ids.map(i => `<i class="dot" style="--c:${A[i].c}" title="${esc(A[i].name)}"></i>`).join('');
const areaTags = (ids) => `<div class="tags">${ids.map(a => `<span><i class="dot" style="--c:${A[a].c}"></i>${esc(A[a].short)}</span>`).join('')}</div>`;
const avatar = (p, root, cls = '') => `<span class="mono-av ${cls}" ${p.photo ? '' : `title="${esc(p.name)}"`}>${p.photo ? `<img src="${esc(href(root, p.photo))}" alt="" loading="lazy">` : initials(p.name)}</span>`;

/* ---------- page shell ---------- */
const initJs = fs.readFileSync(path.join(ROOT, 'src/assets/a11y-init.js'), 'utf8').trim();
const asset = n => `assets/${n}?v=${hash(path.join(ROOT, 'src/assets', n))}`;

function shell({ title, desc, root, urlPath, body, scripts = [], ld, type = 'website', noindex = false }) {
  const canon = siteUrl + urlPath;
  const nav = [['projects', 'Projects'], ['people', 'People'], ['papers', 'Papers'], ['press', 'Press'], ['join', 'Join']].map(([id, l]) => `<a href="${root}#${id}">${l}</a>`).join('');
  return `<!doctype html>
<html lang="en" data-motion="on">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#ffffff">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(canon)}">`}
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${esc(site.title)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canon)}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="${root}favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=Instrument+Sans:wght@400..700&family=DM+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="${root}${asset('site.css')}">
<script>${initJs}</script>
${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body id="top">
<a class="skip" href="#main">Skip to content</a>
<header class="wrap top">
  <a class="brand" href="${root || '#top'}" aria-label="${esc(site.title)}, home">
    <svg viewBox="0 0 30 30" aria-hidden="true"><rect width="30" height="30" rx="9" fill="var(--ink)"/><path d="M6 20 C9 8, 13 8, 14 15 S19 22, 24 9" fill="none" stroke="var(--bg)" stroke-width="2.4" stroke-linecap="round" pathLength="1"/><circle cx="24" cy="9" r="2.4" fill="var(--accent)"/></svg>
    ${esc(site.brand)}
  </a>
  <div class="top-r">
    <nav aria-label="Sections">${nav}</nav>
    <div class="a11y-wrap" id="a11y"></div>
  </div>
</header>
${body}
<footer>
  <div class="wrap foot-grid">
    <div><h2 class="mono">${esc(site.title)}</h2><p>${esc(site.address)}</p>${manageEnabled ? `<p class="updated"><a href="${root}manage/">Lab members: edit this site</a></p>` : ''}<p class="updated">Last updated on <time datetime="${lastUpdated.date}">${new Date(lastUpdated.date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</time></p></div>
    <div><h2 class="mono">Sections</h2><ul>${['projects', 'people', 'papers', 'press'].map(s => `<li><a href="${root}#${s}">${s[0].toUpperCase() + s.slice(1)}</a></li>`).join('')}</ul></div>
    <div><h2 class="mono">Links</h2><ul>${(site.links || []).map(l => `<li><a href="${esc(l.url)}">${esc(l.label)}</a></li>`).join('')}</ul></div>
  </div>
</footer>
<script src="${root}${asset('a11y.js')}" defer></script>
${scripts.map(s => `<script src="${root}${s}" defer></script>`).join('\n')}
</body>
</html>
`;
}

/* ---------- detail-page building blocks ---------- */
function paperCard(p) {
  const title = p.link ? `<a href="${esc(p.link)}">${esc(p.title)}</a>` : esc(p.title);
  const side = (p.award ? `<span class="badge award">${esc(p.award)}</span>` : '') + (p.book ? '<span class="badge">Book</span>' : '') + `<span class="dots">${dots(p.areas)}</span>`;
  return `<article class="paper"><div class="yr">${p.year}</div><div><h3>${title}</h3>${p.au ? `<p class="au">${esc(p.au)}</p>` : ''}${p.ve ? `<p class="ve">${esc(p.ve)}</p>` : ''}</div><div class="side">${side}</div></article>`;
}
function mediaCard(m, root) {
  const url = m.link || (m.file ? href(root, m.file) : '');
  const title = url ? `<a href="${esc(url)}">${esc(m.title)}</a>` : esc(m.title);
  const thumb = m.thumb ? `<div class="mthumb"><img src="${esc(href(root, m.thumb))}" alt="" loading="lazy"></div>` : '';
  return `<article class="media">${thumb}<h3>${title}</h3>${m.au ? `<p>${esc(m.au)}</p>` : ''}<p class="mono">${[m.ve, m.year].filter(Boolean).map(esc).join(' · ')}</p><div class="row"><span class="badge">${MEDIA_KINDS[m.kind]}</span>${m.file && m.link ? `<a href="${esc(href(root, m.file))}">Download</a>` : ''}</div></article>`;
}
function videoBlock(p, root) {
  const v = videoInfo(p.video); if (!v) return '';
  if (v.kind !== 'file') return `<div class="video"><iframe src="${esc(v.embed)}" title="Video: ${esc(p.title)}" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  return `<div class="video"><video controls preload="metadata" playsinline${p.poster ? ` poster="${esc(href(root, p.poster))}"` : ''}><source src="${esc(href(root, v.src))}">${p.captions ? `<track kind="captions" src="${esc(href(root, p.captions))}" srclang="en" label="English" default>` : ''}Your browser can't play this video. <a href="${esc(href(root, v.src))}">Download it</a>.</video></div>`;
}

const groupLabel = Object.fromEntries(GROUPS);
function personPage(p) {
  const root = '../../';
  const myProjects = projects.filter(x => x.people.includes(p.id));
  const myPapers = papers.filter(x => x.people.includes(p.id));
  const myMedia = media.filter(x => x.people.includes(p.id));
  const adv = p.advisor ? P[p.advisor] : null;
  const contact = [
    p.email && `<li><span class="mono">Email</span><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></li>`,
    p.orcid && `<li><span class="mono">ORCID</span><a href="https://orcid.org/${esc(p.orcid)}">${esc(p.orcid)}</a></li>`,
    p.website && `<li><span class="mono">Website</span><a href="${esc(p.website)}">${esc(p.website.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a></li>`,
    adv && `<li><span class="mono">Supervisor</span><a href="${root}people/${adv.id}/">${esc(adv.name)}</a></li>`
  ].filter(Boolean);
  const bio = paras(p.bioLong || p.bio);
  const body = `<main id="main" class="wrap detail">
  <a class="crumb" href="${root}#people">← People</a>
  <div class="profile">
    <div class="portrait${p.featured ? ' lead' : ''}">${p.photo ? `<img src="${esc(href(root, p.photo))}" alt="Portrait of ${esc(p.name)}">` : `<span aria-hidden="true">${initials(p.name)}</span>`}</div>
    <div>
      <h1>${esc(p.name)}</h1>
      <p class="role">${esc(p.role)}${p.status === 'alumni' ? ' <span class="badge status">Alumni</span>' : p.chia ? ' <span class="badge">CHIA</span>' : ''}</p>
      ${p.status === 'alumni' && (p.years || p.now) ? `<p class="now">${[p.years && `In the group ${esc(p.years)}`, p.now && `Now: ${esc(p.now)}`].filter(Boolean).join(' · ')}</p>` : ''}
      ${p.areas.length ? areaTags(p.areas) : ''}
      <div class="prose">${bio}</div>
      ${contact.length ? `<ul class="contact" aria-label="Contact">${contact.join('')}</ul>` : ''}
    </div>
  </div>
  ${myProjects.length ? `<h2 class="subhead">Projects</h2><div class="related">${myProjects.map(x => `<a class="card" href="${root}projects/${x.id}/"><h3>${esc(x.title)}</h3><p>${esc(x.blurb || '')}</p></a>`).join('')}</div>` : ''}
  ${myPapers.length ? `<h2 class="subhead">Papers</h2><div class="papers">${myPapers.map(paperCard).join('')}</div>` : ''}
  ${myMedia.length ? `<h2 class="subhead">Posters &amp; media</h2><div class="medialist">${myMedia.map(m => mediaCard(m, root)).join('')}</div>` : ''}
</main>`;
  const ld = { '@context': 'https://schema.org', '@type': 'Person', name: p.name, jobTitle: p.role, affiliation: { '@type': 'CollegeOrUniversity', name: 'University of Cambridge' }, url: siteUrl + `people/${p.id}/`, ...(p.photo ? { image: isAbs(p.photo) ? p.photo : siteUrl + p.photo } : {}), ...(p.website || p.orcid ? { sameAs: [p.website, p.orcid && `https://orcid.org/${p.orcid}`].filter(Boolean) } : {}) };
  return shell({ title: `${p.name} · ${site.title}`, desc: (p.bio || `${p.name}, ${p.role}`).slice(0, 200), root, urlPath: `people/${p.id}/`, body, ld, type: 'profile' });
}

function projectPage(p) {
  const root = '../../';
  const team = p.people.map(id => P[id]);
  const ps = p.papers.map(id => PA[id]).sort((a, b) => b.year - a.year);
  const ms = media.filter(m => m.projects.includes(p.id));
  const body = `<main id="main" class="wrap detail">
  <a class="crumb" href="${root}#projects">← Projects</a>
  <h1>${esc(p.title)}</h1>
  ${p.areas.length ? areaTags(p.areas) : ''}
  <div class="prose" style="margin-bottom:28px">${paras(p.description || p.blurb)}</div>
  ${videoBlock(p, root)}
  ${team.length ? `<h2 class="subhead" style="margin-top:12px">Team</h2><ul class="team">${team.map(t => `<li><a href="${root}people/${t.id}/">${avatar(t, root)}${esc(t.name)}</a></li>`).join('')}</ul>` : ''}
  ${ps.length ? `<h2 class="subhead">Papers</h2><div class="papers">${ps.map(paperCard).join('')}</div>` : ''}
  ${ms.length ? `<h2 class="subhead">Posters &amp; media</h2><div class="medialist">${ms.map(m => mediaCard(m, root)).join('')}</div>` : ''}
</main>`;
  return shell({ title: `${p.title} · ${site.title}`, desc: (p.blurb || p.title).slice(0, 200), root, urlPath: `projects/${p.id}/`, body });
}

/* ---------- home page ---------- */
function indexPage() {
  const contacts = people.filter(p => p.contact && p.email);
  const clientData = {
    AREAS: areas,
    PEOPLE: people.map(({ bioLong, email, ...r }) => r),
    PROJECTS: projects.map(({ description, video, captions, poster, ...r }) => r),
    PAPERS: papers, PRESS: press,
    UNDERGRADS: undergrads.map(({ id, ...r }) => r),
    MEDIA: media.map(({ ...r }) => r),
    GROUPS, MEDIA_KINDS,
    PUBLICATIONS_URL: site.publicationsUrl || ''
  };
  const json = JSON.stringify(clientData).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const body = `<main id="main">
  <div class="herozone">
    <canvas id="field" aria-hidden="true"></canvas>
    <div class="wrap hero">
      <div class="mono" data-in style="--d:60ms">${esc(site.dept)}</div>
      <h1>${esc(site.title)}</h1>
      <div class="hero-lower">
        <div>
          <p class="lede" data-in style="--d:640ms">${esc(site.lede)}</p>
          <div class="search" data-in style="--d:760ms" role="search">
            <label for="q"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span class="sr">Search the lab</span></label>
            <input id="q" type="text" autocomplete="off" spellcheck="false" placeholder="Search projects, people, papers" role="combobox" aria-expanded="false" aria-controls="results" aria-label="Search the lab">
            <kbd aria-hidden="true">/</kbd>
            <ul id="results" class="results" role="listbox" hidden></ul>
          </div>
        </div>
        <div class="pad" data-in style="--d:420ms">
          <div class="pad-head"><span class="mono">Draw a word</span><span class="mono">Gesture keyboard</span></div>
          <svg id="kb" viewBox="-0.2 -0.2 10.4 3.4" role="img" aria-label="On-screen keyboard. Drag across letters to spell a word and the page responds. You can also use the search box.">
            <g id="keys"></g>
            <g id="trailg"><path id="trail2" d=""/><path id="trail" d=""/></g>
          </svg>
          <div class="decode" aria-live="polite"><span class="out" id="out">Drag a path through the letters</span><span id="cands"></span></div>
          <div class="tryrow" id="try"></div>
        </div>
      </div>
    </div>
  </div>

  <div class="lensbar" role="region" aria-label="Research areas">
    <div class="wrap">
      <div class="lenses" id="lenses"></div>
      <div class="tally" id="tally" role="status" aria-live="polite" hidden></div>
    </div>
  </div>

  <div class="wrap">
    <section id="map" aria-labelledby="h-map">
      <div class="sec-head"><h2 id="h-map">Pull on it</h2><p>Everyone, every project and every research area, wired together by who works on what. Drag anything, and the rest of the lab follows. Click to jump to it.</p></div>
      <div class="mapcard rv">
        <canvas id="mapcv" role="img" aria-label="Interactive network linking lab members, projects and research areas. The same information is listed in the sections below."></canvas>
        <div class="maphud">
          <span class="key2"><i style="width:16px;height:16px;background:var(--a-hci)"></i>Research area</span>
          <span class="key2"><i style="width:11px;height:11px;border-radius:4px;background:var(--ink-3)"></i>Project</span>
          <span class="key2"><i style="width:11px;height:11px"></i>Person</span>
          <span class="spacer"></span>
          <button class="chip" id="shuffle" type="button">Shuffle</button>
        </div>
      </div>
    </section>

    <section id="projects" aria-labelledby="h-projects">
      <div class="sec-head"><h2 id="h-projects">Projects</h2><p>The research threads running through the lab right now, from simulated users to accessible virtual reality.</p></div>
      <div class="projects" id="projectMount">${noscriptList(projects, 'projects', x => x.title)}</div>
    </section>

    <section id="people" aria-labelledby="h-people">
      <div class="sec-head"><h2 id="h-people">People</h2><p>Hover or tap anyone to see the projects and papers they are part of. Open a profile for a full bio and contact details.</p></div>
      <div id="peopleMount">${noscriptList(people, 'people', x => x.name)}</div>
    </section>

    <section id="papers" aria-labelledby="h-papers">
      <div class="sec-head"><h2 id="h-papers">Papers</h2><p>Recent work from the group, including ${papers.filter(p => p.award).length} award-recognised papers, plus posters and other media.</p></div>
      <div id="paperMount"></div>
      ${site.publicationsUrl ? `<p class="morelink">Complete list, including patents and books: <a href="${esc(site.publicationsUrl)}">${esc(site.publicationsUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\.html$/, ''))}</a></p>` : ''}
    </section>

    <section id="press" aria-labelledby="h-press">
      <div class="sec-head"><h2 id="h-press">In the press</h2><p>Earlier coverage of the lab's work on text entry, gestures and multi-display interfaces.</p></div>
      <div class="axis" id="axis" aria-hidden="true"></div>
      <div class="press" id="pressMount"></div>
    </section>

    <section id="join" aria-labelledby="h-join">
      <div class="cta">
        <h2 id="h-join">Work with us</h2>
        <p>${esc(site.joinText)}</p>
        <div class="cta-contacts">${contacts.map(c => `<div><span class="who">${esc(c.name)}</span><span class="mail"><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></span><button class="chip copy" data-copy="${esc(c.email)}" type="button" aria-label="Copy ${esc(c.name)}'s email address">Copy address</button></div>`).join('')}</div>
        <svg viewBox="0 0 200 120" aria-hidden="true"><path d="M10 100 C40 10, 80 10, 95 70 S150 110, 190 20" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/></svg>
      </div>
    </section>
  </div>
</main>
<svg id="links" aria-hidden="true"></svg>
<script type="application/json" id="site-data">${json}</script>`;

  const ld = { '@context': 'https://schema.org', '@type': 'ResearchOrganization', name: site.title, url: siteUrl, description: site.description, parentOrganization: { '@type': 'CollegeOrUniversity', name: 'University of Cambridge' } };
  return shell({ title: `${site.title} · University of Cambridge`, desc: site.description, root: '', urlPath: '', body, scripts: [asset('home.js')], ld });
}
/* Without JavaScript the home page still lists every profile and project, so crawlers and screen readers get the content. */
function noscriptList(list, dir, label) {
  return `<noscript><ul>${list.map(x => `<li><a href="${dir}/${x.id}/">${esc(label(x))}</a></li>`).join('')}</ul></noscript>`;
}

/* The sheet link is encrypted at build time (AES-256-GCM, key from the shared
   password via PBKDF2), so the published page contains no readable link. The browser decrypts it when the right password is typed (assets/manage.js). */
function encrypt(html, password) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12), iter = 600000;
  const cipher = crypto.createCipheriv('aes-256-gcm', crypto.pbkdf2Sync(password, salt, iter, 32, 'sha256'), iv);
  const ct = Buffer.concat([cipher.update(html, 'utf8'), cipher.final(), cipher.getAuthTag()]); // WebCrypto expects ciphertext + tag
  return { s: salt.toString('base64'), i: iv.toString('base64'), c: ct.toString('base64'), n: iter };
}
function managePage() {
  const root = '../';
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
  const body = `<main id="main" class="wrap detail">
  <a class="crumb" href="${root}">← Home</a>
  <h1>Edit the website</h1>
  <div class="prose">
    <form id="unlock" class="unlock" autocomplete="off">
      <p>For lab members. Enter the shared password to open the editing sheet.</p>
      <label class="sr" for="pw">Password</label>
      <input id="pw" type="password" autocomplete="current-password" required>
      <button class="chip best" type="submit">Open the sheet</button>
      <p id="unlock-msg" role="alert" class="unlock-msg" hidden></p>
    </form>
    <p id="opening" role="status" hidden>Opening the sheet… <a id="opening-link" href="#">Click here if nothing happens</a>.</p>
    <noscript><p>This page needs JavaScript.</p></noscript>
    <h2 class="subhead" style="margin-top:40px">How it works</h2>
    <p>Everything on this site comes from one shared Google Sheet. Change a row and the website updates itself, usually within an hour.</p>
    <p><strong>Your profile:</strong> in the <em>People</em> tab, find your row and edit your role, bio, email, website, or paste a link to your photo in the <em>photo</em> column.</p>
    <p><strong>Projects, papers, posters:</strong> add a row to <em>Projects</em>, <em>Papers</em> or <em>Media</em>. Spell people and projects exactly as they appear in their own tab. Separate several with a semicolon.</p>
    <p>Never change the <em>id</em> column. The sheet's File → Version history can undo any mistake.</p>
  </div>
</main>
<script type="application/json" id="vault">${JSON.stringify(encrypt(sheetUrl, editPassword)).replace(/</g, '\\u003c')}</script>`;
  return shell({ title: `Edit the website · ${site.title}`, desc: 'For lab members.', root, urlPath: 'manage/', body, scripts: [asset('manage.js')], noindex: true });
}

function notFound() {
  const base = (() => { try { return new URL(siteUrl).pathname; } catch { return '/'; } })();
  const body = `<main id="main" class="wrap detail"><h1>Page not found</h1><div class="prose"><p>That page doesn't exist, or it has moved.</p><p><a href="${base}">Back to the home page</a></p></div></main>`;
  return shell({ title: `Page not found · ${site.title}`, desc: 'Page not found', root: base, urlPath: '404.html', body, noindex: true });
}

/* ---------- write everything ---------- */
function write(rel, text) { const f = path.join(DIST, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); }
function copyDir(src, dst) { if (!fs.existsSync(src)) return; fs.cpSync(src, dst, { recursive: true }); }

if (model.warnings.length) console.warn('\nWarnings:\n' + model.warnings.map(w => '  - ' + w).join('\n'));
if (model.errors.length) {
  console.error('\nThe site was NOT built. Please fix these problems in the content:\n' + model.errors.map(e => '  - ' + e).join('\n') + '\n');
  process.exit(1);
}

/* "Last updated" is the date the content last changed, not the date of the latest (hourly) build.
   We hash the content and compare with the hash recorded by the currently live site: same hash keeps the old date. */
{
  const synced = path.join(ROOT, 'public/img/synced');
  const files = fs.existsSync(synced) ? fs.readdirSync(synced).sort().map(f => f + hash(path.join(synced, f))) : [];
  const h = crypto.createHash('sha1').update(JSON.stringify({ site, areas, people, projects, papers, media, press, files })).digest('hex');
  const today = new Date().toISOString().slice(0, 10);
  lastUpdated = { hash: h, date: today };
  if (!/example\.org/.test(siteUrl) && !process.env.NO_LIVE_CHECK) {
    try {
      const live = await (await fetch(siteUrl + 'content-version.json', { signal: AbortSignal.timeout(8000) })).json();
      if (live.hash === h && /^\d{4}-\d{2}-\d{2}$/.test(live.date)) lastUpdated.date = live.date;
    } catch { /* first deploy, or live site unreachable: use today */ }
  }
}
fs.rmSync(DIST, { recursive: true, force: true });
copyDir(path.join(ROOT, 'public'), DIST);
['site.css', 'a11y.js', 'home.js', 'manage.js'].forEach(f => { fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true }); fs.copyFileSync(path.join(ROOT, 'src/assets', f), path.join(DIST, 'assets', f)); });
write('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30"><rect width="30" height="30" rx="9" fill="#0B0C0E"/><path d="M6 20 C9 8, 13 8, 14 15 S19 22, 24 9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="24" cy="9" r="2.4" fill="#2540FF"/></svg>\n`);
write('index.html', indexPage());
people.forEach(p => write(`people/${p.id}/index.html`, personPage(p)));
projects.forEach(p => write(`projects/${p.id}/index.html`, projectPage(p)));
write('404.html', notFound());
if (manageEnabled) write('manage/index.html', managePage());
write('content-version.json', JSON.stringify(lastUpdated) + '\n');
const urls = ['', ...people.map(p => `people/${p.id}/`), ...projects.map(p => `projects/${p.id}/`)];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${esc(siteUrl + u)}</loc></url>`).join('\n')}\n</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /manage/\nSitemap: ${siteUrl}sitemap.xml\n`);
if (/example\.org/.test(siteUrl)) console.warn('\nNote: "url" in content/site.json is still the placeholder, so canonical links and the sitemap point at example.org.');
console.log(`\nBuilt ${people.length} people, ${projects.length} projects, ${papers.length} papers, ${media.length} media items → dist/ (${urls.length + 1} pages)`);
