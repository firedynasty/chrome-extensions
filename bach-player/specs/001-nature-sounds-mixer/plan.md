# Implementation Plan: Nature Sounds Mixer

**Branch**: `001-nature-sounds-mixer` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-nature-sounds-mixer/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Replace the popup's embedded Beats Maker panel with a Nature Sounds panel
that plays five fixed ambient tracks (Rainforest Rain, Forest Birdsong,
Relaxing Wind, Epic Thunder Rain, Ocean Waves) simultaneously and in sync, each on its own volume slider
(defaulting to maximum) with a single shared play/pause toggle. Technical
approach: five native `<audio loop>` elements owned by `offscreen.js`
(Constitution Principle II — persistence lives in the offscreen document),
driven by two new relayed message types (`natureToggle`, `natureVolume`)
that follow the exact pattern already used for `toggleNoise`/`noiseVolume`
and the `beatsToggle`/`beatsVolume` messages being removed, with state
persisted via `chrome.storage.local` from `popup.js` the same way
`beatsLiveGrid`/`beatsLiveBpm` are today. No new permissions, no new build
tooling, no change to `playlists.json` or its generator.

## Technical Context

**Language/Version**: JavaScript (vanilla, browser-native ES2020+; no transpilation) — matches the rest of the extension.

**Primary Dependencies**: None (no npm packages). Uses only: `chrome.runtime` messaging, `chrome.storage.local`, `chrome.offscreen`, and the browser's native `HTMLAudioElement` (`<audio>`).

**Storage**: `chrome.storage.local`, one new key `natureMix` (`{ isPlaying, volumes }`) — see data-model.md.

**Testing**: Manual, via "Load unpacked" in `chrome://extensions` (no automated test suite exists in this project — Constitution "Development Workflow"). Validation steps are in quickstart.md.

**Target Platform**: Chrome/Chromium Manifest V3 extension — popup (`popup.html`/`popup.js`) + offscreen document (`offscreen.html`/`offscreen.js`) + service worker (`background.js`).

**Project Type**: Single project — existing flat browser-extension file layout (no `src/`/`frontend`/`backend` split).

**Performance Goals**: Not throughput-sensitive; the only "performance" concern is perceived audio sync — five independently looping ~30-minute `<audio>` elements must stay close enough in phase that drift across one full 30-minute loop is not noticeable in casual listening (SC-003). No numeric latency target beyond that; native `<audio loop>` looping is sufficient (research.md D1).

**Constraints**: No new `manifest.json` permissions or CSP directives (research.md confirms current CSP already permits loading the Dropbox-hosted `.m4a` URLs via `<audio src>`); no build step or new dependency (Constitution Principle III); must not touch `playlists.json`/`generate_playlists.py` (Constitution Principle IV — out of scope, research.md D2).

**Scale/Scope**: Exactly five fixed tracks (extended 2026-09-11 from an original three), no user-editable content for this feature; UI scope is one popup panel (replacing the existing Beats Maker panel in place).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Generated Data Is Never Hand-Edited | ✅ PASS (N/A) | This feature never reads or writes `playlists.json`; the track URLs are hardcoded constants in `offscreen.js`, the same category as the `BEATS_TRACKS` map they replace (research.md D2). |
| II. Offscreen Document Owns Audio Persistence | ✅ PASS | All `<audio>` elements, their play/pause/volume state, and looping live in `offscreen.js`. `background.js` only creates the offscreen document and relays messages. `chrome.storage` calls happen only in `popup.js` (saving) and `background.js` (reading on offscreen creation), never in `offscreen.js` — see contracts/messages.md. |
| III. Minimal Permissions, No Build Step | ✅ PASS | No `manifest.json` changes (permissions or CSP) are needed (research.md). Implementation is plain additions to the existing `popup.html`/`popup.js`/`background.js`/`offscreen.js` files; no new script tag, no bundler, no npm dependency. |
| IV. Playlist Format Stability | ✅ PASS (N/A) | `playlists/*.txt` parsing and `generate_playlists.py` are untouched by this feature. |
| V. Keyboard-First Single-User UX | ✅ PASS (documented gap, not introduced by this feature) | The mixer's toggle is mouse/click-only, same as the white-noise button and the beats-play button it replaces — `popup.js` has no keydown handling for *any* embedded control today (research.md D5); the README's stale keyboard table belongs to the already-disconnected `metronome.html` from a prior refactor, predating this feature. Adding a one-off shortcut for only this new control was rejected as inconsistent scope creep beyond what was asked. |

No violations requiring justification — Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-nature-sounds-mixer/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── messages.md      # Phase 1 output (/speckit-plan command) — popup↔background↔offscreen message contract
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

This project uses a single flat extension layout — no `src/`, no
frontend/backend split, no mobile targets. This feature only touches files
that already exist at the repo root; no new files or directories are
introduced.

```text
bach-player/                  # repository root = extension root
├── manifest.json              # unchanged (no new permissions/CSP — see Technical Context)
├── popup.html                 # edited: "Beats Maker" panel markup → "Nature Sounds" panel markup (5 sliders + toggle)
├── popup.js                   # edited: remove beats-panel JS (BEATS_TRACKS et al.), add nature-mixer UI wiring + natureMix persistence
├── background.js              # edited: ensureOffscreen() also replays saved natureMix state via natureLoadState on offscreen creation
├── offscreen.html             # unchanged
├── offscreen.js                # edited: remove beats sequencer (`ensureBeatsAudio`, `beatsScheduler`, etc.), add NATURE_TRACKS constants + 5 <audio> elements + natureToggle/natureVolume/natureLoadState handling + state fields in getState()
└── README.md                   # edited: "Adding New Basketball..." N/A — update any beats-panel references (if present) to describe the Nature Sounds panel instead
```

**Structure Decision**: No structural change — this feature is implemented
entirely as edits to the four existing files above (`popup.html`,
`popup.js`, `offscreen.js`, and `README.md` for docs), matching
Constitution Principle III's "no build step" and the project's existing
single-flat-project layout. `manifest.json` and `background.js` require no
changes (see Constitution Check).

## Complexity Tracking

*No entries — Constitution Check reported no violations.*
