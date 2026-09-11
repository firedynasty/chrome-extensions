# Phase 1 Data Model: Nature Sounds Mixer

## Nature Sound Track (fixed, code-defined — not persisted as its own record)

One of exactly five constant entries defined in `offscreen.js` (extended
2026-09-11 from an original three per follow-up user request), replacing
the `BEATS_TRACKS`/`BEATS_LABELS` maps.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable short key, e.g. `rain`, `birds`, `wind`, `thunder`, `ocean`. Used as the object key everywhere else in this data model. |
| `label` | string | Display name shown next to its slider: "Rainforest Rain", "Forest Birdsong", "Relaxing Wind", "Epic Thunder Rain", "Ocean Waves". |
| `url` | string | Fixed Dropbox direct-download URL (`?raw=1`) for that track's audio file, per FR-002. |

Fixed set (no create/update/delete — this is not user-editable content, per
research.md D2):

```js
const NATURE_TRACKS = [
  { id: 'rain',    label: 'Rainforest Rain',   url: '<rainforest rain URL>' },
  { id: 'birds',   label: 'Forest Birdsong',   url: '<forest birdsong URL>' },
  { id: 'wind',    label: 'Relaxing Wind',     url: '<relaxing wind URL>' },
  { id: 'thunder', label: 'Epic Thunder Rain', url: '<epic thunder rain URL>' },
  { id: 'ocean',   label: 'Ocean Waves',       url: '<ocean waves URL>' },
];
```

## Nature Mixer State (persisted)

Single `chrome.storage.local` record under the key `natureMix`, following
the same save-from-`popup.js` / restore-into-offscreen pattern as the
existing `beatsLiveGrid`/`beatsLiveBpm` keys (Constitution Principle II —
`offscreen.js` never calls `chrome.storage` directly).

| Field | Type | Range / Default | Notes |
|---|---|---|---|
| `isPlaying` | boolean | default `false` | Shared play/paused state for all tracks (FR-003). `false` on first-ever use — no autoplay (Edge Cases). |
| `volumes` | object, keyed by track `id` | each value `0–100`, default `100` for every track | Per-track volume (FR-004, FR-005). `0` means silent but still playing/looping in sync (User Story 2, Acceptance Scenario 2). |

Example shape:

```json
{
  "isPlaying": true,
  "volumes": { "rain": 100, "birds": 40, "wind": 100, "thunder": 100, "ocean": 70 }
}
```

**Validation rules**:
- `volumes` MUST contain an entry for every id in `NATURE_TRACKS`; a missing
  id is treated as its default (`100`).
- Each volume value MUST be clamped to `0–100` before being applied or
  saved (matches the existing `beatsVolSlider`/`noiseVolume` 0–100 slider
  convention referenced in spec.md Assumptions).

## Runtime-only state (not persisted)

Held in `offscreen.js` while the offscreen document is alive; rebuilt from
`Nature Mixer State` whenever the offscreen document is (re)created.

| Field | Type | Notes |
|---|---|---|
| `natureAudioElements` | map of track `id` → `HTMLAudioElement` | One looping `<audio>` element per track (research.md D1). |
| `natureTrackErrors` | map of track `id` → boolean | Set `true` when that element's `error` event fires; drives FR-011's "unavailable" indicator without blocking the other tracks. Not persisted — reset on every offscreen (re)start, since a failed load is retried by construction. |

## State transitions

```
[not yet initialized] --(offscreen doc created)--> [paused, volumes=defaults or restored]

[paused] --(toggle pressed / natureToggle message)--> [playing]
  effect: every non-errored track's <audio>.play() is called; positions stay
  wherever they were left (resume-in-place, User Story 1 Acceptance Scenario 3)

[playing] --(toggle pressed / natureToggle message)--> [paused]
  effect: every track's <audio>.pause() is called; positions retained

[playing] --(one track's <audio> fires 'ended')--> [playing]
  effect: that track's <audio> restarts from 0. Primarily via native `loop = true`;
  as a fallback (native looping isn't fully reliable for a ~30min network-streamed
  file), an explicit 'ended' listener also seeks to 0 and calls .play() again —
  see offscreen.js's initNatureAudio(). Either way, the other tracks are
  unaffected — FR-006, FR-007

[any state] --(one track's <audio> fires 'error')--> [same state, that track flagged unavailable]
  effect: natureTrackErrors[id] = true; UI shows the track as unavailable;
  the remaining tracks' state is untouched — FR-011

[any state] --(volume slider moved for track X)--> [same isPlaying, volumes[X] updated]
  effect: only natureAudioElements[X].volume changes — FR-004, User Story 2
  Acceptance Scenario 1
```
