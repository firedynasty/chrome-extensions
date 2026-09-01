#!/usr/bin/env python3
"""bach_player.py — Add YouTube videos to bach-player playlists.json.

Fetches video metadata (title + chapters) via yt-dlp --skip-download,
then writes an entry into playlists.json.  No audio/video is downloaded.

Commands:
  add   <youtube-url-or-id> -c <category> [-o playlists.json]
  list  [-o playlists.json]          show categories and entry counts

Shell alias (add to ~/.zshrc):
  bachplayer() {
    python3 ~/Documents/technical/github/extensions/bach-player/bach_player.py add "$1" -c "${2:-classical}"
  }
"""

import argparse, json, re, subprocess, sys
from pathlib import Path

EXTENSION_DIR = Path(__file__).parent
DEFAULT_OUTPUT = EXTENSION_DIR / 'playlists.json'

VID_RE = re.compile(r'(?:v=|youtu\.be/|shorts/)([\w-]{6,})')

def video_id(url_or_id):
    m = VID_RE.search(url_or_id)
    return m.group(1) if m else url_or_id.strip()

def get_metadata(url):
    """Return (title, youtubeId, chapters) using yt-dlp --skip-download."""
    try:
        out = subprocess.check_output(
            ['yt-dlp', '--skip-download', '--print-json', '--no-playlist', url],
            stderr=subprocess.DEVNULL, text=True
        )
        info = json.loads(out)
        title = info.get('title', '')
        vid = info.get('id', video_id(url))
        chapters = []
        for ch in info.get('chapters') or []:
            start = int(ch.get('start_time', 0))
            h, rem = divmod(start, 3600)
            m, s = divmod(rem, 60)
            chapters.append({
                'time': f'{h}:{m:02d}:{s:02d}' if h else f'{m}:{s:02d}',
                'seconds': start,
                'title': ch.get('title', f'Chapter {len(chapters)+1}')
            })
        return title, vid, chapters
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass

    # Fallback: oEmbed for title only
    try:
        import urllib.request, urllib.parse
        url_enc = urllib.parse.quote(url, safe='')
        with urllib.request.urlopen(
            f'https://www.youtube.com/oembed?url={url_enc}&format=json', timeout=8
        ) as resp:
            data = json.loads(resp.read())
        return data.get('title', ''), video_id(url), []
    except Exception:
        return '', video_id(url), []

def cmd_add(args):
    import urllib.parse  # ensure available for fallback
    url = args.url if 'youtube' in args.url or 'youtu.be' in args.url \
        else f'https://www.youtube.com/watch?v={args.url}'

    print(f'Fetching metadata for {url} ...')
    title, vid, chapters = get_metadata(url)
    if not title:
        title = vid
        print(f'  (could not fetch title, using video ID as name)')
    else:
        print(f'  Title: {title}')
    if chapters:
        print(f'  Chapters: {len(chapters)}')

    out_path = Path(args.o)
    playlists = {}
    if out_path.exists():
        with open(out_path) as f:
            playlists = json.load(f)

    category = args.c
    if category not in playlists:
        playlists[category] = []
        print(f'  Created new category: {category}')

    # Check for duplicate
    for e in playlists[category]:
        if e.get('youtubeId') == vid:
            print(f'  Already exists in [{category}]: {e["name"]}')
            return 0

    entry = {'name': title, 'youtubeId': vid, 'tracks': chapters}
    playlists[category].append(entry)

    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(playlists, f, indent=2, ensure_ascii=False)

    print(f'  Added to [{category}] -> {out_path}')
    return 0

def cmd_list(args):
    out_path = Path(args.o)
    if not out_path.exists():
        print(f'No playlists file at {out_path}'); return 1
    with open(out_path) as f:
        playlists = json.load(f)
    for cat, entries in playlists.items():
        print(f'{cat}: {len(entries)} entries')
        for e in entries:
            vid = e.get('youtubeId', '?')
            ch = len([t for t in e.get('tracks', []) if 'seconds' in t])
            print(f'  [{vid}] {e["name"]}' + (f' ({ch} chapters)' if ch else ''))
    return 0

def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('-o', default=str(DEFAULT_OUTPUT), help=f'playlists.json path (default: {DEFAULT_OUTPUT})')
    sub = p.add_subparsers(dest='cmd', required=True)

    a = sub.add_parser('add', help='add a YouTube video to a category')
    a.add_argument('url', help='YouTube URL or video ID')
    a.add_argument('-c', default='classical', metavar='CATEGORY', help='category name (default: classical)')
    a.set_defaults(func=cmd_add)

    l = sub.add_parser('list', help='list categories and entries')
    l.set_defaults(func=cmd_list)

    args = p.parse_args()
    return args.func(args)

if __name__ == '__main__':
    raise SystemExit(main())
