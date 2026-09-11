# Contract: popup ↔ background ↔ offscreen messages (Nature Sounds Mixer)

This extends the extension's existing internal message protocol (`popup.js`
`send()` → `background.js` relay, adding `target: 'offscreen'` → handled in
`offscreen.js`'s `chrome.runtime.onMessage` listener, exactly like
`toggleNoise`/`noiseVolume`/the `beatsToggle`/`beatsBpm`/`beatsVolume`
messages being replaced). No new relay logic is needed in `background.js` —
any message shape below is forwarded unchanged by the existing
"forward everything with `target:'offscreen'` added" logic.

## Commands: popup → offscreen (via background relay)

### `natureToggle`

Toggles the shared play/paused state for all tracks (FR-003).

```json
{ "type": "natureToggle" }
```

No payload. No response body is required (`sendResponse` may be omitted,
matching `beatsToggle`); the offscreen document broadcasts an updated state
(see below) as a side effect.

### `natureVolume`

Sets one track's volume (FR-004). Sent on slider `input`, same as
`noiseVolume`/`beatsVolume` today.

```json
{ "type": "natureVolume", "track": "rain", "value": 40 }
```

- `track`: one of the fixed ids in `data-model.md`'s `NATURE_TRACKS`
  (`"rain" | "birds" | "wind" | "thunder" | "ocean"`).
- `value`: integer `0–100`.

Invalid/unknown `track` values are ignored (no-op), matching this
codebase's existing pattern of not validating message payloads defensively
beyond what's needed to avoid a crash.

## Broadcast: offscreen → popup

No new message `type` is introduced. The nature-mixer fields are added to
the existing unlabeled state broadcast (`getState()` → `broadcastState()` in
`offscreen.js`, sent as a plain `chrome.runtime.sendMessage(state)` with no
`type` field, exactly like `beatsIsPlaying`/`beatsBpm`/`beatsVolume` today)
so the popup's existing `chrome.runtime.onMessage` state-handling listener
(`popup.js` around the `state.beatsIsPlaying !== undefined` checks) picks
them up the same way, with no new listener needed.

Added fields on the state object:

```json
{
  "natureIsPlaying": true,
  "natureVolumes": { "rain": 100, "birds": 40, "wind": 100, "thunder": 100, "ocean": 100 },
  "natureErrors": { "rain": false, "birds": false, "wind": false, "thunder": false, "ocean": false }
}
```

- `natureIsPlaying`: mirrors `Nature Mixer State.isPlaying` — drives the
  toggle button's icon/label (FR-010).
- `natureVolumes`: mirrors `Nature Mixer State.volumes` — drives each
  slider's displayed position (FR-010), including reflecting a value changed
  by this same popup's own `natureVolume` message (round-trip, matching how
  `beatsVolume` already round-trips).
- `natureErrors`: mirrors the runtime-only `natureTrackErrors` map — drives
  the per-track "unavailable" indicator (FR-011) without needing a separate
  message type.

`popup.js` applies these fields the same way it applies
`state.beatsIsPlaying`/`state.beatsBpm`/`state.beatsVolume` today: guarded
by `!== undefined` so older/partial state objects don't clear the UI.

## Persistence side effects (not wire messages)

- On receiving `natureToggle` or `natureVolume`, `offscreen.js` updates its
  in-memory state and calls `broadcastState()`; it does **not** call
  `chrome.storage` itself (Constitution Principle II).
- `popup.js`'s existing state-broadcast handler is responsible for writing
  `natureIsPlaying`/`natureVolumes` into `chrome.storage.local` under the
  `natureMix` key whenever they change, mirroring how `saveBeatsLiveState()`
  persists `beatsLiveGrid`/`beatsLiveBpm` today.
- On offscreen-document creation, `background.js`'s `ensureOffscreen()` reads
  `natureMix` from `chrome.storage.local` and sends a `natureLoadState`
  message (payload = the stored `{ isPlaying, volumes }`) to the freshly
  created offscreen document, mirroring how it already replays
  `loadPlaylists` from `bachPlaylists` after creating the offscreen document.

### `natureLoadState` (background → offscreen, on offscreen creation only)

```json
{ "target": "offscreen", "type": "natureLoadState", "isPlaying": true, "volumes": { "rain": 100, "birds": 40, "wind": 100, "thunder": 100, "ocean": 100 } }
```

If `isPlaying` is `true`, the offscreen document starts all tracks
immediately on load (User Story 3 / FR-009 — resuming playback automatically
on reopen). If no `natureMix` record exists yet (first-ever use),
`background.js` omits this message and `offscreen.js`'s own defaults apply
(`isPlaying: false`, every volume `100`, per Edge Cases / FR-005).
