# Page Scroll Buttons

Overlays two round page up / page down buttons (bottom-right) on any page, e.g. X/Twitter.
Style is taken from the buttons in vercel_bible_current.

## Install
1. `chrome://extensions` -> Developer mode -> Load unpacked -> select this folder.
2. Click the toolbar icon on a page to show the buttons; click again to hide them.

## Notes
- Page down scrolls 90% of the viewport, page up 1/3 (smooth). If the page uses an inner scroll container instead of the window, the largest scrollable element is used.
- Buttons are faint (15% opacity) until hovered.
- Cannot inject on `chrome://` pages.
- The buttons persist across page loads in the same tab (e.g. biblegateway next chapter). Closing the tab or clicking the icon turns them off. If you navigate to a different site the injection is blocked until you click the icon again.
