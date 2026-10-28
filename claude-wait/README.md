# Claude Wait

A **Wait** button you can put on any page. Click it while a Claude Code session is working: a pulsing border shows on the button, and when Claude finishes the border is removed and the button disarms.

It needs the local server from `claude_hooks_server` running, because that is where the "is Claude working" state comes from. If it is not running, the button shows **Need local server: run node server.js in claude_hooks_server**.

## Install

1. Start the server: `cd ~/Documents/technical/github/claude_hooks_server && node server.js`
2. Open `chrome://extensions`, enable **Developer mode**
3. Click **Load unpacked** and choose this `claude-wait` folder

## Usage

- Click the toolbar icon: a Wait chip appears at the bottom-right of the page (click the icon again, or the x, to remove it)
- Click **Wait** to arm it. Blue pulsing border = Claude is working. Amber = Claude needs you (a permission prompt). Border gone and "Done" = finished
- Click the button again to disarm without waiting

State comes from `GET http://127.0.0.1:8787/state` (`working`, `waiting` or `idle`), computed from `~/.claude/activity.jsonl`. A session with no events for 30 minutes counts as idle (`STATE_STALE_MIN` on the server changes this), because Esc-interrupts never log a Stop.

The only host permission is `http://127.0.0.1:8787/*`. Cannot run on `chrome://` pages.

## Icons

```bash
python generate_icons.py
```
