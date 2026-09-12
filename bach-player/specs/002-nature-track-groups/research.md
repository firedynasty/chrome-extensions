# Phase 0 Research: Nature Sound Groups Toggle

## Context gathered from the existing codebase (feature 001)

- `offscreen.js` already holds `NATURE_TRACKS` (5 fixed `{id, label, url}` entries),
  in-memory `natureVolumes` (`{id: 0-100}`), `natureIsPlaying` (boolean), and
  `natureTrackErrors` (`{id: boolean}`). `natureSetVolume(trackId, value)` writes
  `natureVolumes[trackId]` directly and sets `el.volume = clamped / 100` on that
  track's `<audio>` element — the stored slider value and the applied audio volume
  are currently the exact same number, one-to-one.
- Persistence already follows: `popup.js` writes `{ isPlaying, volumes }` to
  `chrome.storage.local` under the `natureMix` key on every relevant state
  broadcast; `background.js`'s `ensureOffscreen()` reads that key back and sends a
  `natureLoadState` message to a freshly created offscreen document;
  `offscreen.js`'s `natureLoadState(isPlaying, volumes)` applies it. No
  `chrome.storage` calls happen inside `offscreen.js` (Constitution Principle II).
- The state broadcast (`getState()` → `broadcastState()`, sent as an unlabeled
  `chrome.runtime.sendMessage(state)`) already carries `natureIsPlaying`,
  `natureVolumes`, `natureErrors`; `popup.js`'s single `applyState()` function
  renders all of them and calls `saveNatureMixState()` whenever any nature field is
  present.

## Decisions

### D1: Group muting is a computed multiplier, never written back into `natureVolumes`

- **Decision**: Introduce a derived "effective volume" for each track —
  `natureVolumes[id] / 100 * (track's group is active ? 1 : 0)` — applied to that
  track's `<audio>.volume` on every event that could change either input (volume
  slider moved, group switched, state loaded). `natureVolumes[id]` itself is never
  modified by muting or reactivating a group.
- **Rationale**: This directly satisfies FR-006 ("muting a group MUST NOT alter the
  stored individual volume-slider position") for free — there is nothing to save and
  restore because the stored value was never touched. It also satisfies User Story 2
  Acceptance Scenario 2 (moving a muted group's slider updates the slider immediately
  but produces no sound until reactivated) without special-casing: the slider write
  always goes to `natureVolumes`, and the effective-volume recompute is what decides
  whether that's currently audible.
- **Alternatives considered**: On mute, copy the current volume elsewhere and zero
  out `natureVolumes[id]`/the slider; on reactivate, copy it back. Rejected — this
  needs extra "saved volume" state per track, has to handle the case where the user
  moves a muted track's slider (do you overwrite the saved value or the live-zeroed
  one?), and risks the slider visibly jumping to 0 while muted, which spec.md's Edge
  Cases and User Story 2 both say must not happen (the slider must keep showing the
  real, unchanged level).

### D2: New `natureGroupToggle` message; `activeGroup` added to the existing `natureMix` storage record

- **Decision**: Add one new relayed message type, `natureGroupToggle`, following the
  exact naming/shape convention of the existing `natureToggle` (no payload — it just
  flips state). Persist the active group as a new `activeGroup` field on the
  existing `natureMix` `chrome.storage.local` record (`{ isPlaying, volumes,
  activeGroup }`), not a separate storage key.
- **Rationale**: One record per feature's persisted state is the pattern feature 001
  already established (and the pattern `beatsLiveGrid`/`beatsLiveBpm` used before
  that, kept as two keys only because they were added at different times — feature
  001 deliberately consolidated to one `natureMix` record). Reusing the same record
  means `background.js`'s existing single read-and-replay call in `ensureOffscreen()`
  needs only one more field threaded through, not a second `chrome.storage.local.get`.
- **Alternatives considered**: A `natureSetActiveGroup` message that takes the target
  group id as a parameter (`{type: 'natureSetActiveGroup', group: 'storm'}`) instead
  of a stateless toggle — rejected as unnecessary for exactly two groups; a bare
  toggle is simpler and matches how `natureToggle`/`beatsToggle` (play/pause) already
  work for a two-state control in this codebase.

### D3: `NATURE_GROUPS` constant array in `offscreen.js`, mirroring `NATURE_TRACKS`

- **Decision**: Define
  `NATURE_GROUPS = [{id:'forest', label:'Forest', trackIds:['rain','birds','wind']}, {id:'storm', label:'Storm', trackIds:['thunder','ocean']}]`
  as a hardcoded constant, the same way `NATURE_TRACKS` is hardcoded (research.md D2
  of feature 001 already established that fixed, developer-chosen data belongs as a
  constant, not in `playlists.json`).
- **Rationale**: Group membership is fixed per spec.md's Assumptions ("not
  user-editable or reconfigurable within this feature"); a hardcoded constant is the
  simplest thing that satisfies that, consistent with Constitution Principle III (no
  build step, no new data-loading mechanism).
- **Group labels** ("Forest" / "Storm"): spec.md's Assumptions leaves exact wording
  to the implementer. Short one-word labels are chosen to fit the existing 320px-wide
  popup alongside a two-button segmented control (see D4).
- **Alternatives considered**: none seriously — this is a direct application of the
  already-established `NATURE_TRACKS` pattern.

### D4: UI — a two-button segmented control, not a single button whose label changes

- **Decision**: Render the group toggle as two adjacent buttons (one per group,
  e.g. "Forest" / "Storm"), with the currently active one visually highlighted
  (matching the existing gold "active" styling already used for
  `natureToggleBtn`/`noiseBtn` when on) and the inactive one dimmed.
- **Rationale**: FR-007 requires the active group to be visibly indicated "at all
  times." A single button that just relabels itself (like `natureToggleBtn`'s
  ▶/⏸ swap) requires reading text to know the current state; a segmented control
  with both options always visible and one highlighted communicates the binary
  choice at a glance, which is a better fit for a "pick one of two named things"
  control than a "flip a single state" control like play/pause.
- **Alternatives considered**: A single toggle button whose text swaps between
  "Forest" and "Storm" (mirroring `natureToggleBtn`'s ▶/⏸ pattern exactly) —
  rejected only on UX grounds (harder to see current state at a glance); not
  meaningfully simpler to implement than two buttons, so the UX case wins.

### D5: `natureLoadState` payload gains `activeGroup`, defaulting to `'forest'` when absent

- **Decision**: Extend the existing `natureLoadState` message
  (`{isPlaying, volumes}` → `{isPlaying, volumes, activeGroup}`); when
  `activeGroup` is missing (an existing user's `natureMix` record saved before this
  feature existed), `offscreen.js` defaults it to `'forest'`.
- **Rationale**: Satisfies FR-009 (default to Group 1 on first-ever use) and also
  covers the "upgrading from feature 001 only" case without a migration step —
  an old stored record simply lacks the field and the same fallback applies.
- **Alternatives considered**: A one-time storage migration that writes
  `activeGroup: 'forest'` into any existing `natureMix` record on first load after
  upgrade — rejected as unnecessary complexity; a runtime default achieves the same
  outcome every time with no migration code to maintain.

## Outcome

All open technical questions are resolved by direct extension of feature 001's
already-established patterns; no `NEEDS CLARIFICATION` markers remain in the
Technical Context.
