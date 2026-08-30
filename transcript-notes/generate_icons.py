from PIL import Image, ImageDraw

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def bar(draw, size, y_frac, x0_frac, x1_frac, color):
    y = size * y_frac
    h = max(2, int(size * 0.075))
    x0, x1 = size * x0_frac, size * x1_frac
    draw.rounded_rectangle([x0, y - h / 2, x1, y + h / 2], radius=h / 2, fill=color)

def create_icon(size, filename):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Vertical green gradient (#43A047 -> #1B5E20), rounded-square mask
    top = (67, 160, 71)
    bot = (27, 94, 32)
    for y in range(size):
        draw.line([(0, y), (size, y)], fill=lerp(top, bot, y / size) + (255,))
    mask = Image.new('L', (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255)
    img.putalpha(mask)

    # Three transcript lines with a checkmark-like dot after the picked one
    white = (255, 255, 255, 255)
    gold = (255, 213, 79, 255)
    bar(draw, size, 0.30, 0.26, 0.74, white)
    bar(draw, size, 0.48, 0.26, 0.74, gold)   # the "selected" sentence
    bar(draw, size, 0.66, 0.26, 0.58, white)
    r = size * 0.045
    cx, cy = size * 0.68, size * 0.66
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=white)

    img.save(filename)

create_icon(48, 'icon48.png')
create_icon(128, 'icon128.png')
print('Transcript Notes icons generated.')
