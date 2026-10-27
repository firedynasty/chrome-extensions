# Gradient Line

A thin moving line in a limited palette (Itten primaries red, yellow, blue, plus white and black) across the top of any webpage. One click on the toolbar icon turns it on; click again to turn it off.

## Install

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and choose this `gradient` folder

## Usage

- Click the toolbar icon to show the line on the current tab (a 3px strip fixed to the top of the viewport, above page content, ignores clicks)
- Click the icon again to remove it
- A small panel opens at top-right with a tempo slider (60-105 bpm, remembered per site; one sweep = 4 beats, with a blinking beat dot); **Done** hides it, **Remove line** turns the line off. Clicking the icon again also removes everything
- Applies to the current tab only and ends when the page reloads or navigates to a new document
- Respects the system "reduce motion" setting (static gradient instead of sliding)

Cannot run on `chrome://` pages (Chrome security restriction).

## Icons

Regenerate with:

```bash
python generate_icons.py
```
