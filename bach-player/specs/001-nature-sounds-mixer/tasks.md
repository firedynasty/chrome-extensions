---

description: "Task list template for feature implementation"
---

# Tasks: Nature Sounds Mixer

**Input**: Design documents from `/specs/001-nature-sounds-mixer/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/messages.md, quickstart.md (all present)

**Tests**: Not requested — this project has no automated test suite (Constitution "Development Workflow"); validation is manual via `quickstart.md`. No test tasks are generated.

**Organization**: Tasks are grouped by user story (spec.md P1/P2/P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task names an exact file path in this repo's flat extension layout (no `src/`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Remove the Beats Maker feature being replaced, so its code/UI/storage no longer conflicts with or gets confused for the new panel.

- [X] T001 In `offscreen.js`, delete the entire Beats Sequencer block: the `BEATS_STEPS`, `beatsCtx`, `beatsMaster`, `beatsBpm`, `beatsIsPlaying`, `beatsCurrentStep`, `beatsNextNoteTime`, `beatsTimer`, `beatsVolume`, `beatsGrid`, `BEATS_SWING`, `BEATS_HUMANIZE` declarations, `ensureBeatsAudio()`, `bKick()`, `bSnare()`, `bHat()`, `bCrash()`, `bTone()`, `beatsScheduler()`, `beatsStart()`, `beatsStop()` (the `// ---- Beats Sequencer ----` section), and the `beatsToggle`/`beatsBpm`/`beatsVolume`/`beatsLoadGrid` branches in the `chrome.runtime.onMessage` listener.
- [X] T002 In `offscreen.js`, remove `beatsIsPlaying`, `beatsBpm`, and `beatsVolume: Math.round(beatsVolume * 100)` from the object returned by `getState()`.
- [X] T003 [P] In `popup.js`, delete the entire `// ── Beats Maker ──` block: `BEATS_TRACKS`, `BEATS_LABELS`, `BEATS_COLORS`, `beatsPresets`, `beatsCurrentGrid`, `beatsDisplayStep`, `saveBeatsPresets()`, `loadBeatsPresetsFromStorage()`, `saveBeatsLiveState()`, `populateBeatsDropdown()`, `initBeats()`, `selectBeatsPreset()`, `renderBeatsGrid()`, `beatsMarkStep()`, the `beatsLoadBtn`/`beatsFileInput`/`beatsPlayBtn`/`beatsBpmSlider`/`beatsVolSlider`/`beatsPanelToggleBtn` event listeners, the `initBeats()` call, the `msg.type === 'beatsStep'` branch in the `chrome.runtime.onMessage` listener, and the `state.beatsIsPlaying`/`state.beatsBpm`/`state.beatsVolume` rendering block.
- [X] T004 [P] In `popup.html`, delete the `<!-- Beats Maker panel -->` block (the `beatsPanelToggleBtn` button and the `beatsPanel` div containing `beatsPresetSelect`, `beatsLoadBtn`, `beatsFileInput`, `beatsPlayBtn`, `beatsBpmSlider`, `beatsBpmLabel`, `beatsGrid`, `beatsVolSlider`, `beatsStatus`).
- [X] T005 [P] Remove any now-stale `beatsPresets`/`beatsLiveGrid`/`beatsLiveBpm` reads from `chrome.storage.local` left in `popup.js` after T003 (confirm none remain outside the deleted block; per Constitution Principle II these were already popup-side, not offscreen-side, so no `offscreen.js` storage calls need removing).

**Checkpoint**: Beats Maker is fully gone from the popup UI, offscreen audio engine, and message handling. Loading the unpacked extension shows no Beats Maker panel and no console errors referencing removed symbols.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core nature-mixer scaffolding that every user story (US1, US2, US3) builds on: the fixed track data, the three audio elements, the panel shell, and baseline state reporting.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 In `offscreen.js`, add the `NATURE_TRACKS` constant array per `data-model.md` — three entries with `id` (`rain`/`birds`/`wind`), `label` (`"Rainforest Rain"`/`"Forest Birdsong"`/`"Relaxing Wind"`), and `url` set to the three Dropbox `?raw=1` URLs supplied in the feature request (Rainforest Rain, Forest Birdsong, Relaxing Wind respectively).
- [X] T007 In `offscreen.js`, add runtime state: `natureAudioElements` (map of track `id` → `HTMLAudioElement`), `natureIsPlaying` (boolean, default `false`), `natureVolumes` (map of track `id` → number 0–100, default `100` for every id per data-model.md), and `natureTrackErrors` (map of track `id` → boolean, default `false` for every id).
- [X] T008 In `offscreen.js`, add `initNatureAudio()`: for each entry in `NATURE_TRACKS`, create `new Audio(track.url)`, set `.loop = true`, set `.volume = natureVolumes[track.id] / 100`, attach an `'error'` listener that sets `natureTrackErrors[track.id] = true` and calls `broadcastState()` (FR-011), and store the element in `natureAudioElements[track.id]`. Call this once, lazily, the first time nature-mixer state is touched (mirrors `ensureBeatsAudio()`'s lazy-init pattern being removed in T001).
- [X] T009 In `offscreen.js`'s `getState()` (per `contracts/messages.md`), add `natureIsPlaying`, `natureVolumes: { ...natureVolumes }`, and `natureErrors: { ...natureTrackErrors }` to the returned object.
- [X] T010 [P] In `popup.html`, replace the deleted Beats Maker block's location with a new collapsible panel shell: a `natureSoundsPanelToggleBtn` button labeled `"▼ Nature Sounds"` (reusing the exact inline styling the removed `beatsPanelToggleBtn` had) and a `natureSoundsPanel` div, per `plan.md`'s Project Structure and `research.md` D4.
- [X] T011 [P] In `popup.js`, add the collapse/expand click handler for `natureSoundsPanelToggleBtn`/`natureSoundsPanel`, copying the exact show/hide + arrow-flip behavior the removed `beatsPanelToggleBtn` listener had (T003 removed the old one; this restores the same interaction for the new panel).

**Checkpoint**: The Nature Sounds panel shell exists and expands/collapses; `offscreen.js` has the three audio elements wired up internally but nothing in the UI can start/stop or adjust them yet. Foundation ready for user stories to build on in parallel.

---

## Phase 3: User Story 1 - Play an ambient nature mix (Priority: P1) 🎯 MVP

**Goal**: A single play/pause toggle starts all three nature tracks playing together, looping continuously, and pauses all three together; a failed track doesn't block the other two.

**Independent Test**: Open the popup, expand the Nature Sounds panel, press the toggle — all three tracks become audible together; press again — all three stop together. Per `quickstart.md` Scenario 1 and 5.

### Implementation for User Story 1

- [X] T012 [US1] In `offscreen.js`, implement `natureToggle()`: call `initNatureAudio()` if not yet initialized, flip `natureIsPlaying`, then call `.play()` (if now playing) or `.pause()` (if now paused) on every `natureAudioElements` entry whose track id is not flagged in `natureTrackErrors` — per FR-003/FR-007, all non-errored tracks change together and errored tracks are skipped without blocking the others (FR-011). Call `broadcastState()` afterward.
- [X] T013 [US1] In `offscreen.js`'s `chrome.runtime.onMessage` listener, add the `msg.type === 'natureToggle'` branch calling `natureToggle()`, per `contracts/messages.md`.
- [X] T014 [US1] In `popup.html`, add a play/pause toggle button (e.g. `natureToggleBtn`) inside `natureSoundsPanel`, styled consistently with the removed `beatsPlayBtn`.
- [X] T015 [US1] In `popup.js`, add a click listener on `natureToggleBtn` that calls `send({ type: 'natureToggle' })`, per `contracts/messages.md`.
- [X] T016 [US1] In `popup.js`'s state-rendering block (where `state.beatsIsPlaying` used to be handled), add: if `state.natureIsPlaying !== undefined`, update `natureToggleBtn`'s icon/label and styling to reflect playing vs. paused (FR-010), mirroring the removed beats-play-button state rendering.
- [X] T017 [US1] In `popup.html`, add a small per-track "unavailable" indicator element next to (or inside) each track's row in `natureSoundsPanel` (e.g. `natureErrorRain`, `natureErrorBirds`, `natureErrorWind`, initially hidden), for FR-011.
- [X] T018 [US1] In `popup.js`'s state-rendering block, add: if `state.natureErrors !== undefined`, show/hide each track's indicator added in T017 based on `state.natureErrors[trackId]`.

**Checkpoint**: User Story 1 is fully functional and independently testable — the mix can be started/stopped as a whole via the toggle, loops natively via each `<audio>` element's `loop = true` (FR-006), and a broken track degrades gracefully instead of blocking playback.

---

## Phase 4: User Story 2 - Balance the mix with per-track volume (Priority: P2)

**Goal**: Each track has its own volume slider, defaulting to maximum, adjustable independently of the others and regardless of play/pause state.

**Independent Test**: With the mix playing at default (max) volume, drag one track's slider down — only that track gets quieter; drag it to zero — that track goes silent but stays playing in sync. Per `quickstart.md` Scenario 2.

### Implementation for User Story 2

- [X] T019 [US2] In `offscreen.js`, implement `natureSetVolume(trackId, value)`: clamp `value` to `0–100` (data-model.md validation rule), update `natureVolumes[trackId]`, set `natureAudioElements[trackId].volume = value / 100` if that element exists, then call `broadcastState()`. Unknown `trackId` is a no-op, per `contracts/messages.md`.
- [X] T020 [US2] In `offscreen.js`'s `chrome.runtime.onMessage` listener, add the `msg.type === 'natureVolume'` branch calling `natureSetVolume(msg.track, msg.value)`, per `contracts/messages.md`.
- [X] T021 [P] [US2] In `popup.html`, add three volume sliders inside `natureSoundsPanel` (e.g. `natureVolRain`, `natureVolBirds`, `natureVolWind`), each `type="range" min="0" max="100"` defaulting to `value="100"` (FR-005), each labeled with its track's display name from `data-model.md`, styled consistently with the removed `beatsVolSlider`.
- [X] T022 [US2] In `popup.js`, add an `'input'` listener on each slider from T021 that calls `send({ type: 'natureVolume', track: '<id>', value: parseInt(e.target.value) })`, matching the existing `noiseVolume`/`beatsVolume` slider-wiring pattern.
- [X] T023 [US2] In `popup.js`'s state-rendering block, add: if `state.natureVolumes !== undefined`, set each slider's `.value` from `state.natureVolumes[trackId]` (round-trip, matching how `state.beatsVolume` used to update `beatsVolSlider`) — FR-010.

**Checkpoint**: User Stories 1 AND 2 both work independently — the mix can be started/stopped and each track's loudness balanced live, with the UI always reflecting current levels.

---

## Phase 5: User Story 3 - Mix settings persist across popup use (Priority: P3)

**Goal**: The mixer's play/paused state and every track's volume survive the popup being closed and reopened, resuming playback automatically if it was playing.

**Independent Test**: Start the mix, set a non-default volume on one track, close the popup, reopen it — toggle still shows "playing", sliders show the saved levels, and sound resumes without pressing play again. Per `quickstart.md` Scenario 3.

### Implementation for User Story 3

- [X] T024 [US3] In `popup.js`, add a `saveNatureMixState()` function that writes `{ isPlaying: <current natureToggleBtn state>, volumes: <current slider values> }` to `chrome.storage.local` under the `natureMix` key, mirroring the removed `saveBeatsLiveState()` pattern (Constitution Principle II — this runs in `popup.js`, never `offscreen.js`).
- [X] T025 [US3] In `popup.js`, call `saveNatureMixState()` from the state-rendering block whenever `state.natureIsPlaying` or `state.natureVolumes` is present (i.e. on every relevant broadcast), so any change made from either the toggle or a slider gets persisted, per `contracts/messages.md`'s "Persistence side effects" section.
- [X] T026 [US3] In `background.js`'s `ensureOffscreen()`, after creating the offscreen document, read the `natureMix` key from `chrome.storage.local` and, if present, send `{ target: 'offscreen', type: 'natureLoadState', isPlaying: <stored isPlaying>, volumes: <stored volumes> }` to it — mirroring the existing `bachPlaylists` → `loadPlaylists` replay already in that function, per `contracts/messages.md`.
- [X] T027 [US3] In `offscreen.js`'s `chrome.runtime.onMessage` listener, add the `msg.type === 'natureLoadState'` branch: call `initNatureAudio()`, set `natureVolumes` and each audio element's `.volume` from `msg.volumes` (falling back to `100` for any track id missing from the payload, per data-model.md's validation rule), set `natureIsPlaying = msg.isPlaying`, and if `msg.isPlaying` is `true`, call `.play()` on every non-errored track's audio element (auto-resume, FR-009) before calling `broadcastState()`.

**Checkpoint**: All three user stories are independently functional — playing, balancing, and persisting the nature-sounds mix all work, matching `quickstart.md` Scenarios 1–5 end to end.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and light documentation cleanup.

- [ ] T028 [P] Run `quickstart.md` Scenarios 1–5 manually via "Load unpacked" in `chrome://extensions`, confirming no console errors in either the popup's or the offscreen document's DevTools console (Constitution "Development Workflow").
- [X] T029 [P] Skim `README.md` for any remaining reference to the Beats Maker panel or its keyboard behavior and remove/update it if found (none were found as of `plan.md`'s writing, but re-check after T001–T004's deletions land).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately. Removes the code/UI being replaced.
- **Foundational (Phase 2)**: Depends on Phase 1 completion (deletions must land first so new symbols/markup don't collide with what's being removed) — BLOCKS all user stories.
- **User Stories (Phase 3–5)**: All depend on Foundational (Phase 2) completion.
  - US1 (T012–T018), US2 (T019–T023), and US3 (T024–T027) each touch disjoint functions/branches in the same three files, so they can be implemented in priority order (US1 → US2 → US3) or, with care to avoid same-file edit collisions, in parallel.
- **Polish (Phase 6)**: Depends on US1–US3 all being complete (validates the whole feature end-to-end).

### User Story Dependencies

- **US1 (P1)**: No dependency on US2/US3. Fully testable alone (mix plays/pauses at a fixed default volume).
- **US2 (P2)**: Builds on the audio elements US1's Foundational phase created; does not require US1's toggle logic to be implemented first, but is only meaningfully testable once US1 exists (need to hear the mix to hear volume changes).
- **US3 (P3)**: Reads/writes state shapes produced by US1 (`natureIsPlaying`) and US2 (`natureVolumes`) — should be implemented last.

### Parallel Opportunities

- T003, T004, T005 (Setup) can run in parallel — different files.
- T010, T011 (Foundational UI shell) can run in parallel with T006–T009 (Foundational offscreen logic) — different files.
- T021 (US2 slider markup) can run in parallel with T019/T020 (US2 offscreen logic) — different files.
- T028, T029 (Polish) can run in parallel.

---

## Parallel Example: Foundational Phase

```bash
# Offscreen-side foundational work:
Task: "Add NATURE_TRACKS constant array in offscreen.js"
Task: "Add nature-mixer runtime state and initNatureAudio() in offscreen.js"

# UI-side foundational work (different file, runs alongside the above):
Task: "Add Nature Sounds panel shell to popup.html"
Task: "Add Nature Sounds panel collapse/expand handler to popup.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (remove Beats Maker).
2. Complete Phase 2: Foundational (audio elements, panel shell).
3. Complete Phase 3: User Story 1 (play/pause the mix as a whole).
4. **STOP and VALIDATE**: Run `quickstart.md` Scenarios 1 and 5 independently.
5. This alone is a usable ambient-sound mixer, even before per-track volume or persistence exist.

### Incremental Delivery

1. Setup + Foundational → Beats Maker gone, Nature Sounds panel shell in place.
2. Add US1 → validate with Scenario 1/5 → usable MVP (fixed max-volume mix, play/pause).
3. Add US2 → validate with Scenario 2 → mix is now balanceable.
4. Add US3 → validate with Scenario 3/4 → mix now survives popup close/reopen and coexists with the main player.
5. Polish → full `quickstart.md` pass.

---

## Notes

- No `[P]` marker is used within a single user-story phase where two tasks edit the same file in a way that depends on ordering (e.g. T012 before T013, both editing `offscreen.js`'s message listener region) — only genuinely different-file or independent-region tasks are marked `[P]`.
- Every task's file path is one of the four files this feature touches per `plan.md`: `offscreen.js`, `popup.html`, `popup.js`, `background.js` (plus `README.md` for Polish only) — no new files are created.
- Commit after each task or logical group; stop at any checkpoint to validate that story independently via the matching `quickstart.md` scenario.
