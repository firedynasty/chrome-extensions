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

    # Clipboard body
    m = int(size * 0.20)
    t = int(size * 0.18)
    b = int(size * 0.84)
    draw.rounded_rectangle([m, t, size - m, b], radius=max(2, int(size * 0.06)),
                           fill=(200, 185, 255, 255))

    # Clip at top
    cw  = int(size * 0.36)
    cx0 = (size - cw) // 2
    ct  = int(size * 0.10)
    cb  = int(size * 0.24)
    draw.rounded_rectangle([cx0, ct, cx0 + cw, cb], radius=max(2, int(size * 0.05)),
                           fill=(120, 100, 200, 255))

    # Two text lines on the page
    lx0 = m + int(size * 0.09)
    lx1 = size - m - int(size * 0.09)
    line_color = (80, 60, 140, 255)
    lh = max(1, int(size * 0.045))
    for frac in [0.38, 0.49]:
        ly = int(size * frac)
        draw.rounded_rectangle([lx0, ly - lh, lx1, ly + lh], radius=lh, fill=line_color)

    # Teal check mark (the "copied" cue) below the lines
    teal = (100, 220, 210, 255)
    w = max(2, int(size * 0.06))
    p0 = (size * 0.34, size * 0.64)
    p1 = (size * 0.46, size * 0.76)
    p2 = (size * 0.68, size * 0.54)
    draw.line([p0, p1], fill=teal, width=w)
    draw.line([p1, p2], fill=teal, width=w)

    img.save(filename)

create_icon(48,  'icon48.png')
create_icon(128, 'icon128.png')
print('Copy Text Tooltip icons generated.')
