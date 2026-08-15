from PIL import Image, ImageDraw

def create_icon(size, filename):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Dark-blue rounded square background
    top = (30, 100, 200)
    bot = (13, 60, 140)
    for y in range(size):
        t = y / size
        c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)) + (255,)
        draw.line([(0, y), (size, y)], fill=c)

    mask = Image.new('L', (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255)
    img.putalpha(mask)

    # Draw "+10" text in white using simple pixel shapes
    # Arrow pointing right (▶) and "+10" label
    cx, cy = size // 2, size // 2
    white = (255, 255, 255, 255)

    # Right-pointing triangle (play symbol)
    tri_size = int(size * 0.25)
    tx = int(cx + size * 0.05)
    for row in range(tri_size * 2):
        half = abs(row - tri_size)
        draw.line([(tx, cy - tri_size + row), (tx + tri_size - half, cy - tri_size + row)], fill=white)

    # "+10" label above: just draw a simple "+" and "10" with rectangles
    bar_h = max(2, size // 16)
    bar_w = int(size * 0.18)
    lx = int(cx - size * 0.28)
    ly = cy

    # "+" horizontal bar
    draw.rectangle([lx - bar_w // 2, ly - bar_h // 2, lx + bar_w // 2, ly + bar_h // 2], fill=white)
    # "+" vertical bar
    draw.rectangle([lx - bar_h // 2, ly - bar_w // 2, lx + bar_h // 2, ly + bar_w // 2], fill=white)

    img.save(filename)
    print(f'Saved {filename}')

create_icon(48, 'icon48.png')
create_icon(128, 'icon128.png')
print('YT Controls icons generated.')
