# Contract: popup ↔ background ↔ offscreen messages (Nature Sound Groups Toggle)

This extends
[001-nature-sounds-mixer's contracts/messages.md](../../001-nature-sounds-mixer/contracts/messages.md).
Only what's new or changed is described here.

## Commands: popup → offscreen (via background relay)

### `natureGroupToggle` (new)

Switches the active group between `forest` and `storm` (FR-002, FR-004).

```json
{ "type": "natureGroupToggle" }
```

No payload — like `natureToggle`, it's a stateless flip: `forest → storm` or
`storm → forest`. No response body is required; the offscreen document
broadcasts an updated state (see below) as a side effect.

`natureVolume` (existing, unchanged) continues to only ever write
`natureVolumes[track]`; it never touches `activeGroup`, and its effect on
audible sound is now filtered through the active group per the Effective Volume
rule in data-model.md — moving a muted group's slider updates the broadcast
`natureVolumes` but produces no audible change until that group is active.

## Broadcast: offscreen → popup

The existing unlabeled state broadcast gains one field:

```json
{
  "natureIsPlaying": true,
  "natureVolumes": { "rain": 100, "birds": 40, "wind": 100, "thunder": 100, "ocean": 100 },
  "natureErrors": { "rain": false, "birds": false, "wind": false, "thunder": false, "ocean": false },
  "natureActiveGroup": "storm"
}
```

- `natureActiveGroup`: mirrors `Nature Mixer State.activeGroup` — drives which
  segmented-control button is shown highlighted (FR-007).

`popup.js` applies it the same way it applies the other `nature*` fields: guarded
by `state.natureActiveGroup !== undefined` so older/partial state objects don't
clear the UI, and triggers the same `saveNatureMixState()` persistence call
already wired up for `natureIsPlaying`/`natureVolumes`.

## Persistence side effects (not wire messages) — extended

- On receiving `natureGroupToggle`, `offscreen.js` flips its in-memory
  `activeGroup`, recomputes every track's effective `<audio>.volume` (data-model.md),
  and calls `broadcastState()`; it does **not** call `chrome.storage` itself
  (Constitution Principle II) — same rule as every other nature-mixer message.
- `popup.js`'s existing state-broadcast handler now also writes `activeGroup`
  into the `natureMix` record in `chrome.storage.local` (alongside
  `isPlaying`/`volumes`) whenever `natureActiveGroup` is present in a broadcast.
- On offscreen-document creation, `background.js`'s `ensureOffscreen()` now also
  threads `activeGroup` from the stored `natureMix` record into the
  `natureLoadState` message it already sends.

### `natureLoadState` (background → offscreen, on offscreen creation only) — extended payload

```json
{ "target": "offscreen", "type": "natureLoadState", "isPlaying": true, "volumes": { "rain": 100, "birds": 40, "wind": 100, "thunder": 100, "ocean": 100 }, "activeGroup": "storm" }
```

If `activeGroup` is missing (an existing `natureMix` record saved before this
feature existed) or is not a recognized group id, `offscreen.js` defaults it to
`'forest'` (research.md D5, FR-009) rather than rejecting the message.
