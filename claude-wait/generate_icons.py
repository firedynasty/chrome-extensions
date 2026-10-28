from PIL import Image, ImageDraw

def create_icon(size, filename):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / size
        c = (int(26 + (10 - 26) * t), int(30 + (14 - 30) * t), int(60 + (40 - 60) * t), 255)
        draw.line([(0, y), (size, y)], fill=c)
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255)
    img.putalpha(mask)

    # a button with a blue border (the "working" cue)
    m = int(size * 0.18)
    top, bot = int(size * 0.34), int(size * 0.66)
    w = max(2, int(size * 0.06))
    draw.rounded_rectangle([m, top, size - m, bot], radius=int(size * 0.1), fill=(43, 43, 64, 255), outline=(77, 163, 255, 255), width=w)
    # three dots inside: waiting
    r = max(1, int(size * 0.04))
    cy = (top + bot) // 2
    for cx in (0.38, 0.5, 0.62):
        x = int(size * cx)
        draw.ellipse([x - r, cy - r, x + r, cy + r], fill=(232, 232, 240, 255))
    img.save(filename)

create_icon(48, 'icon48.png')
create_icon(128, 'icon128.png')
print('Claude Wait icons generated.')
