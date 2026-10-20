# How to edit the website

Everything on the website (people, projects, papers, posters and media) lives in one shared Google Sheet. Edit the sheet and the website updates itself, usually within an hour.
You don't need an account or any technical knowledge.

## Getting in

1. Go to the website and click **Lab members: edit this site** in the footer (or add `/manage/` to the address).
2. Enter the shared password (ask the site administrator). You'll be taken straight to the sheet.

Please don't share the password or the sheet link outside the group.

The sheet has six tabs: **People**, **Projects**, **Papers**, **Media**, **Press**, **Undergrads**. One row per item. A **Start here** tab repeats these instructions.

## Update your own profile

1. Open the **People** tab and find your row.
2. Edit any of these columns:

| Column | What to put |
|---|---|
| `role` | e.g. `PhD student · Clare Hall` |
| `bio` | 1–3 sentences. Shown on the People grid. |
| `bioLong` | Your full bio for your own page. Leave a blank line between paragraphs. If empty, `bio` is used. |
| `email`, `website` | Shown on your page. Leave empty if you'd rather not list them. |
| `orcid` | Your ORCID iD, like `0000-0002-1825-0097` (a pasted orcid.org link works too). Your new papers are then added to the website automatically (see below). |
| `photo` | A link to a photo (see below). Square crops look best. |
| `areas` | Research areas, separated by `;`: `HCI; Accessibility & AAC` |
| `status` | `current` or `alumni`. When you leave, change to `alumni` and fill in `years` and `now`. |

3. Wait up to an hour, then check your page.

**Don't change the `id` column.** It forms your page's web address. For a new row, leave `id` empty and it is made from your name.

### Photos
Upload your photo to Google Drive, set sharing to **Anyone with the link**, and paste the link into `photo`. The website copies it when it builds. JPG or PNG, under 8 MB.

## Papers appear automatically from ORCID

Every Monday the website checks the ORCID record of each current member who has an `orcid` in the People tab, and adds any new papers it finds
(journal articles, conference papers, books and chapters). Nothing else is needed from you, but:

- Make sure the works on your ORCID record are **public** (ORCID → your record → set each work's visibility to "Everyone").
- Only papers from **2024 onwards** are picked up. If you joined later, put the year in the `joined` column so earlier papers on your record are ignored.
- Automatic papers have no project or award. To fix one, add a row for it in the **Papers** tab with the **same link (DOI)**: your row replaces the automatic one.
  Put the project in `projects`, add `award`, correct the venue, and so on.
- To remove one, add that row and set `visible` to `FALSE`.

## Undergraduate alumni

Add one row per person to the **Undergrads** tab: `name`, `year` (and an optional `note`, like where they went next).
They appear in a pop-up under **People → Alumni → Our undergraduate alumni**, newest year first.

## Add a project

New row in **Projects**: `title`, `areas`, `people` (names separated by `;`), and `blurb` (one or two sentences for the card).
Optional: `description` (longer text for the project page), `video`, `poster`, `captions`.

- **`video`**: a YouTube or Vimeo link, or the address of an `.mp4` file. Please add `captions` (a `.vtt` file) for videos with speech.
- **`poster`**: a still image used as the card thumbnail. On hover, `.mp4` videos preview silently on the card (unless the visitor has paused motion).

## Add a paper

New row in **Papers**: `title`, `year`, `au` (authors), `ve` (venue, e.g. `CHI 2026`), `link`.
Put the project title in `projects` and your name in `people`, and the paper shows up on the project page and on your page automatically.
`award` is for things like `Best Paper Award`. `vs` is the short badge text and can be left empty.

## Add a poster or media item

New row in **Media**. `kind` is one of `poster`, `video`, `talk`, `demo`. Use `link` for the web address and `thumb` for a preview image.

## Rules that keep the site healthy

- People, projects and areas are matched by **name**, so spell them exactly as they appear in their own tab. Separate several with `;`.
- Web addresses must start with `https://`.
- Dates in **Press** look like `2013-08-21`. Format that column as Plain text (Format → Number → Plain text) so Sheets doesn't rewrite them.
- To hide a row without deleting it, set `visible` to `FALSE`.
- Made a mistake? **File → Version history** in the sheet undoes anything.

## If your change doesn't appear

If a row has a mistake (a misspelt name, a broken link), the website **keeps showing the last good version** instead of breaking. The administrator gets an email from GitHub saying
which row and what's wrong. Fix the row and it goes live on the next update.
