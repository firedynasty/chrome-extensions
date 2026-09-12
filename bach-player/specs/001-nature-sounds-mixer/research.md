# Phase 0 Research: Nature Sounds Mixer

## Context gathered from the existing codebase

- The main music player currently streams via a hidden YouTube IFrame
  (`offscreen.js` `createYTFrame`), **not** direct `<audio>` playback of a
  remote file — despite `README.md` still describing a Dropbox-hosted-file
  workflow. Nothing in the current codebase plays a remote audio *file* URL
  today; white noise and the beats panel being replaced both use the Web
  Audio API purely to *synthesize* sound (`AudioContext` + buffers), not to
  stream a remote file.
- `manifest.json`'s `content_security_policy` only restricts `script-src` and
  `object-src`, and allowlists `frame-src` for `https://www.youtube.com`. It
  sets no `media-src` or `connect-src`, so loading `<audio src="https://www.
  dropbox.com/...">` is not blocked by CSP — the same reasoning that already
  lets the YouTube iframe and Web Audio contexts run without extra
  permissions.
- `manifest.json` permissions are `["offscreen", "storage", "tabs"]`; no host
  permissions are declared or needed for any current remote fetch (the
  YouTube iframe embeds cross-origin without `host_permissions`). Dropbox
  direct-download links behave the same way for an `<audio>` element.
- The Beats Maker panel being replaced keeps its own hardcoded track/label
  maps (`BEATS_TRACKS`, `BEATS_LABELS`, `BEATS_COLORS` in `popup.js`) — it is
  not routed through `playlists.json` / `generate_playlists.py`. Persisted
  live state (`beatsLiveGrid`, `beatsLiveBpm`) is saved via
  `chrome.storage.local` from `popup.js`, not from `offscreen.js` directly
  (`offscreen.js` cannot call `chrome.storage` — see Constitution Principle
  II, which the codebase has already hit as a bug).
- `popup.js` currently has **no keydown handling at all**. The keyboard
  shortcuts table in `README.md` (`o`/`p`, `[`/`]`, `Space` for metronome,
  etc.) actually belongs to `metronome.html`, a separate standalone page that
  was disconnected from the popup when the beats panel replaced the
  metronome (see commit `c5017d1`, "remove metronome"). The table is already
  stale for the current popup, independent of this feature.

## Decisions

### D1: Playback mechanism — native `<audio>` elements, not Web Audio API buffers

- **Decision**: Implement each of the three nature tracks as its own
  `HTMLAudioElement` (`new Audio(url)`) appended in the offscreen document,
  with `element.loop = true` for seamless looping and `element.volume` (0–1)
  driving that track's independent gain.
- **Rationale**: `<audio>` gives native remote-URL streaming and native
  gapless-enough looping for a ~30-minute ambient file with zero manual
  buffering/scheduling code. The beats panel needed the Web Audio API only
  because it synthesizes short percussive one-shots on a swung/humanized
  clock — none of that timing precision is needed for three independently
  looping ambient beds, so pulling in `AudioContext`/`AudioBufferSourceNode`
  here would add real complexity (manual seam-free re-scheduling on every
  loop boundary, remote `fetch` + `decodeAudioData` handling) for no
  perceptible benefit.
- **Alternatives considered**: Web Audio API with `decodeAudioData` +
  `AudioBufferSourceNode` chained through a `GainNode` per track (matching
  the beats/noise pattern) — rejected as disproportionate for this use case;
  would still need a `MediaElementAudioSourceNode` or manual re-triggering to
  loop past the buffer's natural end anyway.

### D2: Track source data — hardcoded constants, not the `playlists/` pipeline

- **Decision**: Define the three tracks (name + source URL) as a constant
  array in `offscreen.js` (mirroring the `BEATS_TRACKS`/`BEATS_LABELS` shape
  being replaced), not as entries under `playlists/` processed by
  `generate_playlists.py`.
- **Rationale**: Constitution Principle IV ("Playlist Format Stability")
  governs the user-authored `playlists/*.txt` → `playlists.json` pipeline
  for the main, sequential single-track player. These three tracks are a
  fixed, developer-chosen ambient mixer with a different playback model
  (simultaneous multi-track, not next/prev single-track) — the same category
  the beats panel's own hardcoded maps already occupy. Routing them through
  the playlist pipeline would force a data shape (single active track,
  genre/album grouping) that doesn't fit a fixed three-way mixer.
- **Alternatives considered**: adding a `playlists/nature/` folder and
  regenerating `playlists.json` — rejected as over-engineering three fixed
  URLs through a pipeline designed for open-ended, user-editable content.

### D3: State persistence — `chrome.storage.local`, saved from `popup.js`

- **Decision**: Persist per-track volume (0–100) and the shared
  playing/paused boolean under a single `natureMix` key in
  `chrome.storage.local`, written from `popup.js` (mirroring exactly how
  `beatsLiveGrid`/`beatsLiveBpm` are saved today) and restored into the
  offscreen document via a message on offscreen startup, matching
  Constitution Principle II's split (no `chrome.storage` calls inside
  `offscreen.js`).
- **Rationale**: This is the only persistence pattern already established in
  this codebase; reusing it keeps `background.js`'s relay role unchanged and
  needs no new API surface.
- **Alternatives considered**: none — this is a direct application of an
  existing, working pattern; no other option was evaluated.

### D4: Panel UI — replace the Beats Maker panel's contents in place

- **Decision**: Keep the existing collapsible-panel shell (the
  `beatsPanelToggleBtn` / `beatsPanel` pair in `popup.html`) but relabel it
  "Nature Sounds" and swap its inner markup for three volume sliders (one per
  track, each labeled) plus a single play/pause button; drop the preset
  dropdown, `.json` loader, BPM slider, step grid, and status line, none of
  which apply to a fixed three-track mixer.
- **Rationale**: Minimal diff, no new CSS system, matches Constitution
  Principle III (no build step/new dependency) and keeps the popup's visual
  language (dark theme, existing button/slider styling) consistent.
- **Alternatives considered**: none — the collapsible-panel shell is
  reusable as-is and there's no reason to redesign it for this feature.

### D5: No new keyboard shortcut

- **Decision**: The nature-mixer play/pause toggle is mouse/click-only, like
  the white-noise toggle button and the beats play button it replaces; no
  keydown handling is added to `popup.js` for it.
- **Rationale**: Constitution Principle V's keyboard-shortcut expectation is
  a SHOULD, and `popup.js` has no keydown handling at all today for *any*
  popup-embedded control (the documented shortcuts belong to the
  disconnected `metronome.html`, a pre-existing gap unrelated to this
  feature). Introducing keydown handling for only this one new control,
  while every sibling button-driven control (white noise, "Access Link",
  the beats button it replaces) has none, would be inconsistent scope creep
  beyond what this feature asks for.
- **Alternatives considered**: bind a shortcut (e.g. reusing the freed `0`
  key now that the metronome/beats panel it was tied to is gone) — left as a
  possible separate follow-up, not part of this feature; the user's request
  did not ask for one and no existing infrastructure makes it a small
  addition.

## Outcome

All open technical questions are resolved by direct precedent in the
existing codebase; no `NEEDS CLARIFICATION` markers remain in the Technical
Context.
