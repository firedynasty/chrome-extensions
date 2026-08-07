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

    # Vertical purple gradient (#AB47BC -> #7B1FA2), rounded-square mask
    top = (171, 71, 188)
    bot = (123, 31, 162)
    for y in range(size):
        draw.line([(0, y), (size, y)], fill=lerp(top, bot, y / size) + (255,))
    mask = Image.new('L', (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255)
    img.putalpha(mask)

    # Three note lines; the last is short with a teal "cursor" dot after it
    white = (255, 255, 255, 255)
    teal = (38, 198, 218, 255)
    bar(draw, size, 0.34, 0.26, 0.74, white)
    bar(draw, size, 0.50, 0.26, 0.74, white)
    bar(draw, size, 0.66, 0.26, 0.56, white)
    r = size * 0.045
    cx, cy = size * 0.66, size * 0.66
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=teal)

    img.save(filename)

create_icon(48, 'icon48.png')
create_icon(128, 'icon128.png')
print('YT Notes icons generated.')
