/**
 * Google Apps Script — deploy this as a web app from your Google Sheet.
 *
 * Setup:
 * 1. Open your Google Sheet
 * 2. Extensions > Apps Script
 * 3. Paste this code, replacing any existing code
 * 4. Click Deploy > New deployment
 * 5. Type: Web app
 * 6. Execute as: Me
 * 7. Who has access: Anyone
 * 8. Click Deploy and copy the URL
 * 9. Paste the URL into the extension's script URL field
 *
 * Sheet format (columns A, B, and C):
 *   A: Date        B: Time      C: Activity
 *   6/29/2026      8:50 AM      work
 *   6/29/2026      9:12 AM      break
 *   6/29/2026      9:15 AM      work
 */

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M/d/yyyy');
  sheet.appendRow([today, data.time, data.activity]);

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Optional: handle GET requests to verify the script is working
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Pomodoro Logger script is running' }))
    .setMimeType(ContentService.MimeType.JSON);
}
