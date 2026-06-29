# Pomodoro Logger

Chrome extension that logs work/break timestamps to a Google Sheet with a single click.

## Sheet Format

| Date | Time | Activity |
|------|------|----------|
| 6/29/2026 | 8:50 AM | work |
| 6/29/2026 | 9:12 AM | break |
| 6/29/2026 | 9:15 AM | work |

## Features

- **Work / Break** buttons log the current time and activity
- **Custom** button for arbitrary activity names (e.g. "lunch", "meeting")
- **Running timer** shows elapsed time since last log entry (persists across popup opens)
- **Local history** of recent entries in the popup
- Works offline — logs locally even without a Google Sheet connected

## Setup

### Google Apps Script

1. Open a Google Sheet
2. **Extensions → Apps Script**
3. Replace the default code with the contents of `apps_script.js`
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the deployed URL

### Chrome Extension

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder
4. Click the extension icon in the toolbar
5. Paste the deployed Apps Script URL and click **Save URL**
6. Press **Work** or **Break** to start logging
