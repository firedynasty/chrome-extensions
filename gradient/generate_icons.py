from PIL import Image, ImageDraw

STOPS = [(211, 47, 47), (224, 123, 46), (245, 224, 80), (143, 224, 58),
         (76, 184, 90), (111, 242, 255), (63, 143, 224), (90, 31, 196)]

def spectrum(t):
    pos = t * (len(STOPS) - 1)
    i = min(int(pos), len(STOPS) - 2)
    f = pos - i
    a, b = STOPS[i], STOPS[i + 1]
    return tuple(int(a[k] + (b[k] - a[k]) * f) for k in range(3))

def create_icon(size, filename):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Dark navy rounded-square background
    top, bot = (26, 30, 60), (10, 14, 40)
    for y in range(size):
        f = y / size
        draw.line([(0, y), (size, y)],
                  fill=tuple(int(top[k] + (bot[k] - top[k]) * f) for k in range(3)) + (255,))
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255)
    img.putalpha(mask)

    # Spectrum bar across the middle
    m = int(size * 0.14)
    h = max(3, int(size * 0.16))
    y0 = (size - h) // 2
    bar = Image.new('RGBA', (size - 2 * m, h))
    bd = ImageDraw.Draw(bar)
    for x in range(bar.width):
        bd.line([(x, 0), (x, h)], fill=spectrum(x / max(1, bar.width - 1)) + (255,))
    bmask = Image.new('L', bar.size, 0)
    ImageDraw.Draw(bmask).rounded_rectangle([0, 0, bar.width - 1, h - 1], radius=h // 2, fill=255)
    img.paste(bar, (m, y0), bmask)

    img.save(filename)

create_icon(48, 'icon48.png')
create_icon(128, 'icon128.png')
print('Gradient Line icons generated.')
