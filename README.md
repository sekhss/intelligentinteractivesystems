# Intelligent Interactive Systems: website

A static site (plain HTML, CSS and JS, no frameworks) generated from structured content.
Needs Node 18+ to build and nothing else: there are no dependencies to install.

```
content/          the data: people, projects, papers, media, press, areas, site settings (JSON)
public/           files copied as-is: photos (img/), posters, PDFs, videos (media/)
src/assets/       site.css, home.js (home-page interactions), a11y.js (accessibility panel)
build.mjs         generates dist/: home page, one page per person and project, sitemap, 404
scripts/          sync-sheet.mjs (Google Sheet → content/), export-sheet.mjs, serve.mjs
.github/workflows deploy.yml: sync, build and publish to GitHub Pages
```

## Run it locally

```
npm run dev          # build and preview at http://localhost:8080
npm run build        # build only (validates all content first)
```

## How content gets edited

Lab members edit a **Google Sheet** (see [EDITING.md](EDITING.md), written for them). A GitHub Action runs
hourly, reads the sheet, validates it and rebuilds the site. If validation fails, nothing is published and the
previous version stays live. The data model is defined once in `scripts/lib/content.mjs` (`SCHEMA`).

If you'd rather not use a sheet, delete the `SHEET_ID` variable and edit `content/*.json` directly. Everything works the same.

## One-time setup

1. **Create the repo** on GitHub and push this folder to `main`. Settings → Pages → Source: **GitHub Actions**.
2. **Create the sheet.** Upload `sheet-template/IIS-website-content.xlsx` to Google Drive and open it with Google Sheets
   (right-click → Open with → Google Sheets, then File → Save as Google Sheets). It contains the current content, a
   "Start here" tab for lab members, dropdowns for status/group/kind, and the five tabs the site reads:
   `People`, `Projects`, `Papers`, `Media`, `Press`. Don't rename those tabs. (Regenerate with `npm run export-sheet`
   then `python3 scripts/make-xlsx.py`.)
3. **Share it:** Share → General access → *Anyone with the link* → **Viewer**. Then add lab members by email as **Editors**.
   Viewer-by-link is what lets the build read it without credentials. Only editors can change it.
4. **Connect it:** copy the long id from the sheet's URL (`/spreadsheets/d/<ID>/edit`), then in the GitHub repo:
   Settings → Secrets and variables → Actions → **Variables** → New: `SHEET_ID` = that id.
5. **Set the real address** in `content/site.json` (`"url"`), used for canonical links and the sitemap.
6. Run the workflow once (Actions → Build and deploy → Run workflow). Turn on GitHub's failure emails
   (Settings → Notifications) so a bad edit reaches you.

Custom domain: Settings → Pages. Hosting elsewhere: `dist/` is plain static files, so upload it anywhere.

### Optional: "Publish now" button in the sheet
Edits go live hourly. For instant publishing, in the sheet use Extensions → Apps Script and paste
`docs/publish-button.gs`, add a fine-grained GitHub token (Actions: read & write on this repo only) as the script
property `GH_TOKEN`, then add the menu. Instructions are in that file.

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
- `content/site.json` holds the headline text, address, footer links and contact settings. Anyone with `contact` = TRUE in the People tab and an email is listed under "Work with us".
