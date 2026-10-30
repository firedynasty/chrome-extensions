# Neuron Breath

A short break from thinking on the computer. Click the toolbar icon and an overlay opens on the current page with two tabs, starting on Breathe.

## Dots

A glowing network of dots joined by thin lines (a nod to the brain-neurons picture). Look at it, estimate how many dots there are, type your guess into **Your count** and press **Check** (or Enter) to see the real number and how far off you were. **New dots** draws a fresh network of 18-60 dots. A stopwatch next to it counts this session; it starts at 0:00 when the Dots tab opens and resets when you switch tabs or close the overlay (New dots does not reset it).

## Breathe

Box breathing, 4 seconds each: breathe in, hold, breathe out, hold. A white circle grows and shrinks with the breath, a ring fills around it over the 16-second cycle, and the current phase and seconds left are shown inside. A stopwatch above the ring counts the time of this session; it starts at 0:00 when you open Breathe and resets when you switch back to Dots or close the overlay.

## Notes

A 3-line notes box sits at the bottom of both tabs. It saves automatically and is shared across all sites and sessions (stored with `chrome.storage.local`, which is why this extension asks for the `storage` permission). Drag its corner to make it taller.

## Usage

- Click the toolbar icon to open the overlay; click it again, press **Esc**, click **Close**, or click outside the panel to close it
- Applies to the current tab only and ends when the page reloads or navigates to a new document
- Respects the system "reduce motion" setting (dots stop drifting and twinkling; the breathing circle still moves because the breath timing is the point)

## Install

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and choose this `neuron-breath` folder

Cannot run on `chrome://` pages (Chrome security restriction).

## Icons

Regenerate with:

```bash
python generate_icons.py
```
