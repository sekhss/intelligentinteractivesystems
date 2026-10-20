# Intelligent Interactive Systems: website

A static site (plain HTML, CSS and JS, no frameworks) generated from a Google Sheet. Needs Node 18+ to build and nothing else: there are no dependencies to install.

```
content/          site.json + areas.json (settings), and a starter copy of the data (people, projects, papers, media, press)
public/           files copied as-is into the site (photos, PDFs, videos)
src/assets/       site.css, home.js (home page), a11y.js (accessibility panel), manage.js (the /manage password page)
build.mjs         generates dist/: home page, a page per person and project, /manage, sitemap, 404
scripts/          sync-sheet.mjs (Google Sheet → content/), fetch-orcid.mjs (new papers from ORCID), export-sheet.mjs + make-xlsx.py (make the starter sheet), serve.mjs
sheet-template/   IIS-website-content.xlsx: upload this to Google Sheets
.github/workflows deploy.yml: sync, build and publish to GitHub Pages (hourly, and on every push)
                  orcid.yml: every Monday, add new papers from members' ORCID records
```

```
npm run dev       # build and preview at http://localhost:8080
npm run build     # build only (validates all content first)
```

## How it works

Lab members edit one **Google Sheet** (tabs: People, Projects, Papers, Media, Press). They reach it from the **Lab members: edit this site** link in the website's footer,
which goes to **/manage**: a password box that forwards to the sheet. Every hour (and on every push) GitHub reads the sheet, checks it, rebuilds the site and publishes.
If a row has a mistake, nothing is published and the previous version stays live. [EDITING.md](EDITING.md) is the guide for lab members.

### How the password works (no server needed)
GitHub Pages only serves files, so nothing on the server can check a password. Instead the build **encrypts** the sheet link (AES-256-GCM, key derived from the password with
600,000 rounds of PBKDF2) and the published `/manage` page contains only scrambled data. The browser decrypts it when the right password is typed, then forwards to the sheet.
The sheet link never appears in readable form in the site or the repo.

Because the sheet is set to *Anyone with the link can edit* (so members need no Google account), **the password is what keeps the link private**:
- Anyone can download the scrambled data and try passwords offline with no lockout, so the password must be **long and unguessable**
  (the build rejects anything under 16 characters; four or five random words is good).
- Anyone who learns the sheet link can edit it. If it leaks, make a copy of the sheet, update `SHEET_ID`, and change the password.
- Everyone shares one password, so you can't remove one person without changing it for everyone.
- Bad edits can't break the site (the build validates everything and escapes it), and File → Version history in the sheet undoes any change.

## One-time setup

1. **Sheet.** Upload `sheet-template/IIS-website-content.xlsx` to Google Drive, open it with Google Sheets, and File → Save as Google Sheets.
   Keep the tab names `People`, `Projects`, `Papers`, `Media`, `Press`. Then Share → General access → **Anyone with the link → Editor**.
2. **GitHub settings** (repo → Settings → Secrets and variables → Actions):
   - **Variables** → `SHEET_ID` = the long id in the sheet's address (`/spreadsheets/d/<ID>/edit`)
   - **Secrets** → `EDIT_PASSWORD` = the shared password (16+ characters)
3. Settings → Pages → Source: **GitHub Actions**.
4. In `content/site.json` set `url` to the real address (see "The web address" below) so canonical links, the sitemap and the "Last updated" date work.
   Commit and push.
5. Actions → Build and deploy → Run workflow. Then open `/manage/` and check the password takes you to the sheet.

### The web address
A GitHub Pages address always starts with the name of the account or organisation that owns the repo, so a personal repo gives `https://<username>.github.io/<repo>/`.
To get a neutral address, create a free GitHub **organisation** (e.g. `iis-cambridge`), transfer the repo to it (repo → Settings → Danger zone → Transfer), and rename the repo to
`iis-cambridge.github.io`. The site is then at `https://iis-cambridge.github.io/`. After transferring, check that the `SHEET_ID` variable, the `EDIT_PASSWORD` secret and Settings → Pages → Source
(GitHub Actions) are still set. A custom domain (Settings → Pages) works too. Whatever you choose, put it in `url` in `content/site.json`.

### Routine jobs
- **Change the password:** update the `EDIT_PASSWORD` secret and re-run the workflow.
- **Publish immediately:** Actions → Build and deploy → Run workflow (otherwise edits go live within the hour).
- **Undo a bad edit:** in the sheet, File → Version history.
- **A build failed:** open the failed run in Actions. The message names the row and what's wrong. The live site is unaffected.
- **Without a sheet:** leave `SHEET_ID` unset and edit `content/*.json` directly. Everything else works the same.

## Papers from ORCID (weekly)

`orcid.yml` runs every Monday (and on demand: Actions → Weekly ORCID update → Run workflow). It reads each **current** member's `orcid` from the sheet,
asks the public ORCID API for their works, and asks Crossref for authors and venue. New papers are appended to `content/papers-auto.json`, which the workflow commits
and then republishes the site. It never edits or deletes anything it has already added, and its commit shows exactly what was added.

- Included: journal articles, conference papers, books, book chapters and preprints (a preprint is dropped when the published version is also found), dated `orcidSince` (in `content/site.json`, currently 2024)
  or later, or from a member's own `joined` year if that is later.
- **The sheet always wins.** A row in the Papers tab with the same DOI (or, failing that, the same title) replaces the automatic paper; with `visible` = FALSE it hides it.
- Only works that are public on the member's ORCID record are visible to this job. Missing authors/venue come from Crossref, and are blank if a paper has no DOI.
- Run it locally with `node scripts/fetch-orcid.mjs --dry-run` (after `npm run sync`) to see what it would add.
- The job commits to `main`, so it needs the workflow permission *Read and write* (set in the workflow file) and no branch protection that blocks the Actions bot.

## "Last updated" date

The footer shows the date the *content* last changed, not the date of the latest hourly build. Each build hashes the content
and compares it with `content-version.json` on the live site: same hash keeps the old date, different hash uses today (UTC).
It needs `url` in `content/site.json` to be the real address; until then it shows the build date.

## Accessibility

An **Accessibility** button on every page offers: pause motion, larger text, high contrast, readable font, underline links.
Choices are saved in the visitor's browser only. The OS "reduce motion" setting is respected by default.
Hover-to-play project videos never play while motion is paused, and project pages use native video controls with optional captions.

## Notes

- GitHub pauses scheduled workflows after 60 days without repository activity. Any commit, or a manual run, restarts them.
- Fonts load from Google Fonts. To self-host (for stricter privacy), download them into `public/fonts/` and replace the `<link>` in `build.mjs`.
- Photos: members paste a link (a Google Drive "anyone with the link" share link, or any public image address). The build downloads it so it keeps working.
  For videos use a YouTube or Vimeo link; for posters, a link or a PDF placed in `public/`.
- Anyone with `contact` = TRUE and an email in the People tab is listed under "Work with us".
