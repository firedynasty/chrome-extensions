from PIL import Image, ImageDraw

def create_icon(size, filename):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=(26, 30, 60, 255))
    w = max(2, int(size * 0.09))
    cx = size // 2
    a = int(size * 0.20)
    # up chevron (upper half), down chevron (lower half)
    for cy, sign in ((int(size * 0.34), 1), (int(size * 0.66), -1)):
        pts = [(cx - a, cy + sign * a // 2), (cx, cy - sign * a // 2), (cx + a, cy + sign * a // 2)]
        d.line(pts, fill=(200, 185, 255, 255), width=w, joint='curve')
    img.save(filename)

create_icon(48, 'icon48.png')
create_icon(128, 'icon128.png')
