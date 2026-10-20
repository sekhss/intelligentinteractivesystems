/**
 * Adds a "Website → Publish now" menu to the Google Sheet.
 * Setup: Extensions → Apps Script, paste this file, then Project Settings → Script properties:
 *   GH_TOKEN  a fine-grained GitHub token limited to this repo, with "Actions: Read and write"
 * Set OWNER and REPO below, save, reload the sheet, and approve the permissions once.
 */
const OWNER = 'YOUR-GITHUB-ORG';
const REPO = 'YOUR-REPO';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Website').addItem('Publish now', 'publishNow').addToUi();
}

function publishNow() {
  const token = PropertiesService.getScriptProperties().getProperty('GH_TOKEN');
  const res = UrlFetchApp.fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/deploy.yml/dispatches`, {
    method: 'post',
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
    contentType: 'application/json',
    payload: JSON.stringify({ ref: 'main' })
  });
  SpreadsheetApp.getActive().toast(res.getResponseCode() === 204 ? 'Publishing. Live in about a minute.' : 'Could not start the update: ' + res.getContentText(), 'Website', 8);
}
