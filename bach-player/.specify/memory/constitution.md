<!--
Sync Impact Report
==================
Version change: [TEMPLATE] → 1.0.0 (initial ratification)
Modified principles: n/a (first adoption; all principles newly defined)
Added sections:
  - Core Principles (I–V)
  - Content & Data Pipeline
  - Development Workflow
  - Governance
Removed sections: none
Templates checked for alignment:
  - .specify/templates/plan-template.md — "Constitution Check" gate reads this file at runtime; no hardcoded principle text to update
  - .specify/templates/spec-template.md — no constitution-specific placeholders; generic, no change needed
  - .specify/templates/tasks-template.md — no constitution-specific placeholders; generic, no change needed
  - .specify/templates/checklist-template.md — no constitution-specific placeholders; generic, no change needed
Deferred TODOs: none — RATIFICATION_DATE set to the date this document was first adopted.
-->

# Bach Player Constitution

## Core Principles

### I. Generated Data Is Never Hand-Edited
`playlists.json` is build output, not source. It MUST be produced only by running
`python generate_playlists.py` against the `.txt` files under `playlists/`. No commit or
change may edit `playlists.json` directly; if its content needs to change, the change MUST
be made in the source `.txt` files (or in `generate_playlists.py`'s parsing logic) and the
script re-run.
**Rationale**: `playlists.json` is explicitly documented as generated ("do not edit by
hand") and is gitignored per-source; hand edits get silently overwritten and desync from
the `playlists/` folder that is the real record of content.

### II. Offscreen Document Owns Audio Persistence
Manifest V3 service workers (`background.js`) are ephemeral and MUST NOT hold playback
state, audio elements, or timers that need to survive across events. Persistent audio
playback, the metronome, and any `AudioContext`/`<audio>` state MUST live in the offscreen
document (`offscreen.html` / `offscreen.js`). `background.js` is limited to lifecycle
management (creating/closing the offscreen document) and message relaying between the
popup and the offscreen document. APIs unavailable in the offscreen context (e.g.
`chrome.storage`) MUST NOT be called from `offscreen.js`; such calls happen in
`background.js` or `popup.js` and are relayed by message.
**Rationale**: this project has already hit and fixed exactly this failure mode
(`chrome.storage` called from the offscreen doc); the offscreen/background split exists
specifically to keep audio alive past service-worker suspension, and violating the split
breaks persistence silently.

### III. Minimal Permissions, No Build Step
`manifest.json` MUST declare only permissions the code actively uses (currently
`offscreen`, `storage`, `tabs`) — no speculative permissions. The extension MUST remain
plain HTML/CSS/JS with no bundler, transpiler, or npm-installed runtime dependency; any
new capability is added as a `<script>`-loaded file or vanilla browser API, matching the
existing `popup.js` / `offscreen.js` / `background.js` structure.
**Rationale**: this is a small personal-use extension loaded via "Load unpacked" —
build tooling and broad permissions add attack surface and review friction with no
corresponding benefit at this scale, and the codebase has never used either.

### IV. Playlist Format Stability
The two supported `playlists/*.txt` formats — (1) one URL per line, optionally
`Track Name,URL`, and (2) a single URL followed by `MM:SS Title` / `H:MM:SS Title`
chapter lines — are a stable contract between user-authored content and
`generate_playlists.py`. Changing the parsing rules for either format, or adding a new
format, MUST update `README.md`'s "Playlist File Formats" section in the same change,
and MUST NOT silently break existing files under `playlists/` (verify by regenerating
`playlists.json` from the `playlists/example/` fixtures and confirming output shape).
**Rationale**: playlist `.txt` files are hand-authored outside the codebase; the parser
changing out from under them without a corresponding doc/behavior update turns existing
playlists into silent data loss.

### V. Keyboard-First Single-User UX
The keyboard shortcuts documented in `README.md` (Space, `+`/`-`, `,`/`.`, `o`/`p`,
`[`/`]`, `0`) are the primary interaction surface and MUST stay in sync between
`popup.js`'s key handling and the README table — add, remove, or rebind a shortcut in
both places in the same change. New interactive features SHOULD expose a keyboard
shortcut rather than requiring a mouse click, consistent with the existing design.
**Rationale**: this extension is built for one user's fast, hands-on-keyboard control
during playback; an undocumented or unbound shortcut is a regression for the only
interaction model that matters here.

## Content & Data Pipeline

Adding or changing music content follows the documented pipeline and no other path:
download audio (`yt-dlp`), host it (Dropbox link with `?raw=1`), add/edit a `.txt` file
under a genre subfolder of `playlists/`, then run `python generate_playlists.py` to
regenerate `playlists.json`. The YouTube video ID embedded in the filename (the 11-char
suffix before the extension) is extracted automatically by the generator and MUST
continue to drive the in-player "YouTube" source link — do not hand-add a separate ID
field. `playlists/` itself stays gitignored; only the generator script and its output
format are versioned.

## Development Workflow

There is no automated test suite; verification is manual via "Load unpacked" in
`chrome://extensions` followed by exercising the popup, offscreen playback, and
keyboard shortcuts touched by the change. Before committing a change that touches
`generate_playlists.py` or the playlist format, regenerate `playlists.json` from the
`playlists/example/` fixtures and confirm it parses without error. Changes to
`manifest.json` permissions or `content_security_policy` require re-loading the
unpacked extension and confirming no console errors, since MV3 silently drops
functionality that violates CSP rather than failing loudly.

## Governance

This constitution supersedes ad hoc practice for this project. Amendments are made by
editing `.specify/memory/constitution.md` (via the `/speckit-constitution` command or
equivalent direct edit), incrementing `CONSTITUTION_VERSION` per semantic versioning
(MAJOR: principle removed/redefined incompatibly; MINOR: principle or section added or
materially expanded; PATCH: wording/clarification only), and updating `Last Amended`.
Every amendment's Sync Impact Report (HTML comment at the top of this file) documents
what changed and is expected to be trimmed once reviewed. Any change touching
`generate_playlists.py`, `manifest.json`, `background.js`, or `offscreen.js` should be
checked against the relevant principle above before merging; a violation must either be
fixed or the constitution amended first, not silently overridden.

**Version**: 1.0.0 | **Ratified**: 2026-09-11 | **Last Amended**: 2026-09-11
