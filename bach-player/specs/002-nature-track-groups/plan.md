# Implementation Plan: Nature Sound Groups Toggle

**Branch**: `002-nature-track-groups` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-nature-track-groups/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Add a single two-position toggle to the existing Nature Sounds panel (feature 001)
that switches which of two fixed groups of tracks — "Forest" (rain, birdsong, wind)
and "Storm" (thunder, ocean) — is audible, muting the other group entirely while
leaving every individual track's own volume slider untouched. Technical approach:
group membership is a new hardcoded `NATURE_GROUPS` constant in `offscreen.js`;
muting is implemented as a derived "effective volume" (`natureVolumes[id] * group
active?`) applied to each `<audio>` element, never by overwriting the stored
per-track slider value, so a muted group's balance is exactly restored when
reactivated. One new relayed message (`natureGroupToggle`), one new broadcast field
(`natureActiveGroup`), and one new field (`activeGroup`) on the existing `natureMix`
persisted record — no new storage key, no new permissions, no build tooling.

## Technical Context

**Language/Version**: JavaScript (vanilla, browser-native ES2020+; no transpilation) — matches the rest of the extension and feature 001.

**Primary Dependencies**: None (no npm packages). Uses only what feature 001 already uses: `chrome.runtime` messaging, `chrome.storage.local`, `chrome.offscreen`, native `HTMLAudioElement`.

**Storage**: `chrome.storage.local`, extending the existing `natureMix` key with one new field, `activeGroup` (`{ isPlaying, volumes, activeGroup }`) — see data-model.md. No new storage key.

**Testing**: Manual, via "Load unpacked" in `chrome://extensions` (no automated test suite exists in this project — Constitution "Development Workflow"). Validation steps are in quickstart.md.

**Target Platform**: Chrome/Chromium Manifest V3 extension — same three contexts as feature 001 (popup, offscreen document, service worker).

**Project Type**: Single project — existing flat browser-extension file layout, extending feature 001's already-in-place Nature Sounds Mixer.

**Performance Goals**: Not throughput-sensitive. Switching groups must feel instant (no restart/reload/re-buffer of any `<audio>` element — only a `.volume` property write per track), satisfying FR-005 and Scenario 1's "no restart lag" expectation.

**Constraints**: No new `manifest.json` permissions or CSP directives (nothing new is fetched — muting only changes which already-loaded `<audio>` elements are audible); no build step or new dependency (Constitution Principle III); must not alter `playlists.json`/`generate_playlists.py` (Constitution Principle IV — untouched, out of scope); must not let group muting overwrite the persisted per-track volume values (FR-006 — enforced by research.md D1's derived-volume design, not by application-level save/restore bookkeeping).

**Scale/Scope**: Exactly 2 fixed groups over the existing 5 fixed tracks; extends the existing `natureMix` persisted record with one field rather than introducing new persisted state shapes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Generated Data Is Never Hand-Edited | ✅ PASS (N/A) | This feature never reads or writes `playlists.json`; `NATURE_GROUPS` is a hardcoded constant in `offscreen.js`, the same category as `NATURE_TRACKS` (research.md D3). |
| II. Offscreen Document Owns Audio Persistence | ✅ PASS | Group-active state, the derived effective-volume computation, and all `<audio>.volume` writes live in `offscreen.js`. `background.js` only relays `natureGroupToggle` and threads `activeGroup` through the existing `natureLoadState` replay on offscreen creation. `chrome.storage` calls happen only in `popup.js` (saving) and `background.js` (reading on offscreen creation), never in `offscreen.js` — see contracts/messages.md. |
| III. Minimal Permissions, No Build Step | ✅ PASS | No `manifest.json` changes. Implementation is plain additions to the same four files feature 001 already edited (`popup.html`, `popup.js`, `background.js`, `offscreen.js`); no new script tag, no bundler, no npm dependency. |
| IV. Playlist Format Stability | ✅ PASS (N/A) | `playlists/*.txt` parsing and `generate_playlists.py` are untouched. |
| V. Keyboard-First Single-User UX | ✅ PASS (documented gap, consistent with feature 001) | The group toggle's two buttons are mouse/click-only, matching every other nature-mixer control (feature 001's Constitution Check already established that `popup.js` has no keydown handling for any embedded control, and that gap predates and is out of scope for the nature-mixer features). |

No violations requiring justification — Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-nature-track-groups/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── messages.md      # Phase 1 output (/speckit-plan command) — extends 001's message contract
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

Same flat extension layout as feature 001 — no new files or directories. This
feature only extends the four files feature 001 already touches.

```text
bach-player/                  # repository root = extension root
├── manifest.json              # unchanged (no new permissions/CSP)
├── popup.html                 # edited: add a 2-button "Forest"/"Storm" segmented control inside the existing Nature Sounds panel
├── popup.js                   # edited: wire the two new buttons to send natureGroupToggle; render natureActiveGroup; extend saveNatureMixState() to include activeGroup
├── background.js              # edited: ensureOffscreen() threads activeGroup from the stored natureMix record into the natureLoadState message it already sends
├── offscreen.html             # unchanged
└── offscreen.js                # edited: add NATURE_GROUPS constant + activeGroup state + natureGroupToggle() + effective-volume recompute helper; extend natureSetVolume/natureLoadState/getState to use/report it
```

**Structure Decision**: No structural change — this feature is implemented
entirely as edits to the same four files feature 001 already edited, matching
Constitution Principle III's "no build step" and the project's existing
single-flat-project layout. `manifest.json` and `offscreen.html`/`popup.html`'s
overall structure need no changes beyond the new control markup.

## Complexity Tracking

*No entries — Constitution Check reported no violations.*
