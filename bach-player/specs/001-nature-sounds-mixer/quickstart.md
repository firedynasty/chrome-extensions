# Quickstart: Validating the Nature Sounds Mixer

## Prerequisites

- Chrome (or any Chromium-based browser) with Developer mode enabled at
  `chrome://extensions`.
- This repo's `bach-player/` folder loaded as an unpacked extension (see
  `README.md` → Installation). If it's already loaded, click the reload
  icon on the extension's card after implementing the feature.
- No build step, no `npm install`, no server — per Constitution Principle
  III, this is plain HTML/CSS/JS loaded directly.

## Setup

1. `chrome://extensions` → toggle **Developer mode** on (top right) if not
   already on.
2. **Load unpacked** → select the `bach-player/` folder (or **reload** its
   card if already loaded).
3. Click the extension's toolbar icon to open the popup.

## Scenario 1 — Play the ambient mix (User Story 1, P1)

1. In the popup, find the panel previously labeled "Beats Maker" — it should
   now read "Nature Sounds" (FR-001).
2. Expand it if collapsed.
3. Press the play/pause toggle button.
4. **Expected**: within a couple seconds, all five tracks (rain, birdsong,
   wind, thunder rain, ocean waves) are audible together. The toggle
   button's icon/label reflects "playing" (FR-010).
5. Press the toggle again.
6. **Expected**: all five tracks stop being audible at the same moment
   (FR-003).
7. Press play once more, wait a few seconds, pause, wait, then press play
   again.
8. **Expected**: each track resumes from where it left off, not from the
   start (User Story 1, Acceptance Scenario 3).

## Scenario 2 — Balance the mix (User Story 2, P2)

1. With the panel expanded and nothing played yet, confirm all five volume
   sliders are already at maximum (FR-005).
2. Start playback (toggle).
3. Drag the "Relaxing Wind" slider down to roughly the middle.
4. **Expected**: only the wind track gets quieter; the other four tracks are
   unaffected (FR-004, SC-002).
5. Drag the wind slider all the way to zero.
6. **Expected**: wind becomes silent but the mix keeps running in sync —
   raising the slider again immediately brings wind back in, still aligned
   with the other tracks (User Story 2, Acceptance Scenario 2).

## Scenario 3 — Persistence across popup close (User Story 3, P3)

1. With the mix playing and at least one non-default volume set (from
   Scenario 2), close the popup (click elsewhere on the page, or press
   Escape).
2. Reopen the popup by clicking the toolbar icon again.
3. **Expected**: the toggle still shows "playing", every slider shows the
   level it was left at, and the mix is audible without pressing play again
   (FR-009, SC-004).
4. Repeat, but pause the mix before closing the popup.
5. **Expected**: on reopen, the toggle shows "paused" and the sliders still
   reflect the last-set levels; nothing plays until the toggle is pressed.

## Scenario 4 — Independence from the main player (Edge Case)

1. Start the nature-sounds mix.
2. Separately, use the main player to start a music track/playlist.
3. **Expected**: both are audible at once; starting one did not pause or
   stop the other (FR-008).

## Scenario 5 — One track fails to load (Edge Case, FR-011)

This can be simulated by temporarily pointing one track's URL (in
`offscreen.js`'s `NATURE_TRACKS`) at an unreachable URL, reloading the
extension, and repeating Scenario 1.

1. With one track's URL broken, press play.
2. **Expected**: the other two tracks still play; the broken track is shown
   as unavailable in the UI rather than the whole mixer failing to start
   (SC-005).
3. Revert the URL change and reload the extension before continuing other
   testing.

## Verifying against the constitution (Development Workflow)

- No automated test suite exists for this project — the scenarios above
  *are* the verification, run manually via "Load unpacked".
- After any change to `manifest.json` permissions or CSP made while
  implementing this feature (expected: **none**, per `research.md`), reload
  the unpacked extension and confirm no console errors in both the popup's
  and the offscreen document's DevTools consoles
  (`chrome://extensions` → the extension card → "service worker" / inspect
  views).
