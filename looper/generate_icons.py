from PIL import Image, ImageDraw
import math

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def arrowhead(draw, x, y, angle_deg, length, half_width, color):
    """Triangle pointing along the tangent (clockwise arc travel)."""
    ta = math.radians(angle_deg + 90)  # tangent for clockwise sweep
    tx, ty = math.cos(ta), math.sin(ta)
    px, py = -ty, tx
    tip = (x + tx * length, y + ty * length)
    base1 = (x + px * half_width, y + py * half_width)
    base2 = (x - px * half_width, y - py * half_width)
    draw.polygon([tip, base1, base2], fill=color)

def create_icon(size, filename):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Vertical teal gradient (#26C6DA -> #0097A7), rounded-square mask
    top = (38, 198, 218)
    bot = (0, 151, 167)
    for y in range(size):
        draw.line([(0, y), (size, y)], fill=lerp(top, bot, y / size) + (255,))
    mask = Image.new('L', (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255)
    img.putalpha(mask)

    # Two-arc loop symbol (like the 🔁 glyph)
    cx = cy = size / 2
    r = size * 0.26
    w = max(2, int(size * 0.06))
    white = (255, 255, 255, 255)
    for start_ang, end_ang in [(200, 340), (20, 160)]:
        bbox = [cx - r, cy - r, cx + r, cy + r]
        draw.arc(bbox, start=start_ang, end=end_ang, fill=white, width=w)
        a = math.radians(end_ang)
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        arrowhead(draw, x, y, end_ang, size * 0.13, size * 0.08, white)

    img.save(filename)

create_icon(48, 'icon48.png')
create_icon(128, 'icon128.png')
print('Loop Mix icons generated.')
