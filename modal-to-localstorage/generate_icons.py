from PIL import Image, ImageDraw

def create_icon(size, filename):
    img = Image.new('RGBA', (size, size), (26, 26, 46, 255))
    draw = ImageDraw.Draw(img)

    # Red rounded rectangle (YouTube-style)
    margin = int(size * 0.12)
    rect_h = int(size * 0.5)
    rect_top = (size - rect_h) // 2
    rect_bottom = rect_top + rect_h
    radius = int(size * 0.1)
    draw.rounded_rectangle(
        [margin, rect_top, size - margin, rect_bottom],
        radius=radius,
        fill=(255, 0, 0, 255)
    )

    # White play triangle
    cx, cy = size // 2, size // 2
    tri_w = int(size * 0.18)
    tri_h = int(size * 0.22)
    draw.polygon(
        [(cx - tri_w // 2 + int(size * 0.03), cy - tri_h),
         (cx - tri_w // 2 + int(size * 0.03), cy + tri_h),
         (cx + tri_w, cy)],
        fill=(255, 255, 255, 255)
    )

    img.save(filename)

create_icon(48, 'icon48.png')
create_icon(128, 'icon128.png')
print('YouTube-style icons generated.')
