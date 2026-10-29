from PIL import Image, ImageDraw
import random

def create_icon(size, filename):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Deep teal rounded-square background
    top, bot = (16, 70, 84), (6, 30, 44)
    for y in range(size):
        f = y / size
        draw.line([(0, y), (size, y)],
                  fill=tuple(int(top[k] + (bot[k] - top[k]) * f) for k in range(3)) + (255,))
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255)
    img.putalpha(mask)

    # Connected glowing dots
    pts = [(.22, .30), (.52, .20), (.80, .34), (.34, .58), (.64, .62), (.78, .82), (.26, .82)]
    px = [(int(x * size), int(y * size)) for x, y in pts]
    for a, b in [(0, 1), (1, 2), (0, 3), (1, 3), (1, 4), (2, 4), (3, 4), (4, 5), (3, 6), (4, 6)]:
        draw.line([px[a], px[b]], fill=(220, 245, 245, 200), width=max(1, size // 48))
    for i, (x, y) in enumerate(px):
        r = max(2, int(size * (0.07 if i in (1, 4) else 0.05)))
        draw.ellipse([x - r * 2, y - r * 2, x + r * 2, y + r * 2], fill=(255, 190, 90, 70))
        draw.ellipse([x - r, y - r, x + r, y + r], fill=(255, 226, 150, 255))

    img.save(filename)

create_icon(48, 'icon48.png')
create_icon(128, 'icon128.png')
print('Neuron Breath icons generated.')
