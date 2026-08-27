from PIL import Image, ImageDraw

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def create_icon(size, filename):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Dark navy gradient background, rounded-square mask
    top = (26, 30, 60)
    bot = (10, 14, 40)
    for y in range(size):
        draw.line([(0, y), (size, y)], fill=lerp(top, bot, y / size) + (255,))
    mask = Image.new('L', (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255)
    img.putalpha(mask)

    # Open book shape: two rectangles + spine line
    m  = int(size * 0.15)        # margin
    cx = size // 2               # center x (spine)
    t  = int(size * 0.22)        # top of pages
    b  = int(size * 0.78)        # bottom of pages
    gap = max(2, int(size * 0.04))

    # Left page
    draw.rounded_rectangle([m, t, cx - gap, b], radius=max(2, int(size * 0.05)),
                            fill=(200, 185, 255, 255))
    # Right page
    draw.rounded_rectangle([cx + gap, t, size - m, b], radius=max(2, int(size * 0.05)),
                            fill=(200, 185, 255, 255))

    # Three text lines on left page
    lx0 = m + int(size * 0.07)
    lx1 = cx - gap - int(size * 0.07)
    line_color = (80, 60, 140, 255)
    lh = max(1, int(size * 0.045))
    for frac in [0.38, 0.50, 0.62]:
        ly = int(size * frac)
        draw.rounded_rectangle([lx0, ly - lh, lx1, ly + lh], radius=lh, fill=line_color)

    # Highlight dot on right page (teal) — the "definition" cursor
    rx0 = cx + gap + int(size * 0.07)
    rx1 = size - m - int(size * 0.07)
    r = size * 0.048
    hx, hy = (rx0 + rx1) / 2, size * 0.50
    draw.ellipse([hx - r, hy - r, hx + r, hy + r], fill=(100, 220, 210, 255))
    # short line after the dot (rest of the "word")
    if rx1 > hx + r + 4:
        draw.rounded_rectangle([hx + r + 3, hy - lh, rx1, hy + lh],
                                radius=lh, fill=line_color)

    img.save(filename)

create_icon(48,  'icon48.png')
create_icon(128, 'icon128.png')
print('Word Definer icons generated.')
