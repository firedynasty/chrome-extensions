from PIL import Image, ImageDraw, ImageFont

def create_icon(size, filename):
    img = Image.new('RGBA', (size, size), (26, 26, 46, 255))
    draw = ImageDraw.Draw(img)

    # Draw a music note symbol
    cx, cy = size // 2, size // 2
    r = int(size * 0.35)

    # Note head (filled ellipse)
    head_w = int(size * 0.22)
    head_h = int(size * 0.16)
    head_cx = cx - int(size * 0.05)
    head_cy = cy + int(size * 0.15)
    draw.ellipse(
        [head_cx - head_w, head_cy - head_h, head_cx + head_w, head_cy + head_h],
        fill=(201, 168, 76, 255)
    )

    # Note stem
    stem_x = head_cx + head_w - int(size * 0.03)
    stem_top = cy - int(size * 0.25)
    stem_bottom = head_cy
    stem_w = max(2, int(size * 0.04))
    draw.rectangle(
        [stem_x, stem_top, stem_x + stem_w, stem_bottom],
        fill=(201, 168, 76, 255)
    )

    # Flag
    flag_x = stem_x + stem_w
    for i in range(int(size * 0.15)):
        y = stem_top + i
        w = int(size * 0.12) * (1 - i / (size * 0.15))
        draw.line([(flag_x, y), (flag_x + w, y + int(size * 0.05))],
                  fill=(201, 168, 76, 255), width=max(1, stem_w // 2))

    img.save(filename)

create_icon(48, 'icon48.png')
create_icon(128, 'icon128.png')
print('Icons generated.')
