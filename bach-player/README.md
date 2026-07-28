# Bach Player

A Chrome extension (Manifest V3) for playing music from Dropbox-hosted audio files. Supports playlist genres, albums with chapter timestamps, metronome, playback speed, white noise, and a 3-minute repeat timer.

## Installation

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `bach-player/` folder

---

## Adding Music

### Step 1 — Download audio from YouTube

Use [yt-dlp](https://github.com/yt-dlp/yt-dlp) to download audio. yt-dlp appends the 11-char YouTube video ID to the filename automatically:

```
yt-dlp -x --audio-format m4a "https://www.youtube.com/watch?v=A6dzSX62gEY"
# → Clear-Mind-Intense-Focus-Ambient-Techno-...-A6dzSX62gEY.m4a
```

### Step 2 — Upload to Dropbox

Upload the `.m4a` file to Dropbox, then get a direct link:
- Right-click the file → **Share** → **Copy link**
- Change `?dl=0` at the end to `?raw=1`

### Step 3 — Add a playlist `.txt` file

Create a `.txt` file inside a genre subfolder under `playlists/`:

```
playlists/
  classical/
    my_playlist.txt
  adhd/
    focus.txt
  example/
    single_tracks.txt
    album_with_chapters.txt
```

### Step 4 — Regenerate `playlists.json`

```bash
python generate_playlists.py
```

---

## Playlist File Formats

### Format 1 — Multiple single tracks (one URL per line)

Each URL becomes a separate track. Optionally prefix with `Track Name,`:

```
Clear Mind Intense Focus,https://www.dropbox.com/.../Clear-Mind-...-A6dzSX62gEY.m4a?raw=1
AGNUS DEI Sacred Choral,https://www.dropbox.com/.../AGNUS-DEI-...-aRwhkBAeheM.m4a?raw=1
```

### Format 2 — Single audio file with chapter timestamps

One URL at the top, followed by `MM:SS Title` lines (or `H:MM:SS`):

```
https://www.dropbox.com/.../AGNUS-DEI-...-aRwhkBAeheM.m4a?raw=1
00:00 BARBER : Agnus Dei
08:00 FAURE : Cantique de Jean Racine
13:25 PALESTRINA : Kyrie
17:42 MOZART : Ave Verum Corpus
```

> The YouTube video ID is extracted automatically from the filename (the 11-char suffix before `.m4a`). A **YouTube** link appears in the player UI whenever a track is playing, so you can navigate back to the original video.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `+` / `-` | Volume up / down |
| `,` / `.` | Playback speed down / up |
| `o` / `p` | BPM down / up |
| `[` / `]` | Previous / next tempo preset |
| `0` | Metronome start / stop |

---

## Folder Structure

```
bach-player/
  manifest.json
  popup.html / popup.js       # Extension UI
  offscreen.html / offscreen.js  # Audio engine (runs in background)
  background.js               # Service worker
  generate_playlists.py       # Builds playlists.json from playlists/
  playlists.json              # Generated — do not edit by hand
  playlists/                  # Gitignored — add your .txt files here
    example/
      single_tracks.txt
      album_with_chapters.txt
```
