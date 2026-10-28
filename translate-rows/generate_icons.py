from PIL import Image, ImageDraw

def create_icon(size, filename):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=(26, 30, 60, 255))
    # Three stacked rows, like the popup's list
    m = int(size * 0.18)
    h = int(size * 0.16)
    gap = int(size * 0.11)
    y = int(size * 0.2)
    for i, w in enumerate((0.64, 0.64, 0.44)):
        d.rounded_rectangle([m, y, m + int(size * w), y + h], radius=max(1, h // 3),
                            fill=(200, 185, 255, 255) if i < 2 else (120, 200, 255, 255))
        y += h + gap
    img.save(filename)

create_icon(48, 'icon48.png')
create_icon(128, 'icon128.png')
