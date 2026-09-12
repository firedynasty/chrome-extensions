from PIL import Image, ImageDraw

def create_icon(size, filename):
    img  = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    m  = int(size * 0.10)   # margin
    r  = int(size * 0.16)   # corner radius
    fold = int(size * 0.22) # fold triangle size

    # Yellow body (leave bottom-right corner for fold)
    body_color  = (255, 230, 0, 255)
    shadow_color = (200, 170, 0, 255)

    # Main rectangle (full)
    draw.rounded_rectangle(
        [m, m, size - m, size - m],
        radius=r,
        fill=body_color
    )

    # White-out the bottom-right corner to carve fold
    # Draw a white triangle over it, then draw the dark fold triangle
    br_x = size - m
    br_y = size - m
    corner_poly = [
        (br_x - fold, br_y),
        (br_x,        br_y - fold),
        (br_x,        br_y),
    ]
    # Carve with background (transparent)
    draw.polygon(corner_poly, fill=(0, 0, 0, 0))

    # Fold shadow triangle (darker yellow)
    fold_poly = [
        (br_x - fold, br_y),
        (br_x,        br_y - fold),
        (br_x - fold, br_y - fold),
    ]
    draw.polygon(fold_poly, fill=shadow_color)

    # Three text lines
    line_color = (150, 110, 0, 255)
    lx0 = m + int(size * 0.14)
    lx1 = size - m - int(size * 0.20)
    lh  = max(1, int(size * 0.05))
    for frac in [0.35, 0.50, 0.65]:
        ly = int(size * frac)
        draw.rounded_rectangle(
            [lx0, ly - lh, lx1, ly + lh],
            radius=lh,
            fill=line_color
        )

    img.save(filename)

create_icon(48,  'icon48.png')
create_icon(128, 'icon128.png')
print('Page Notes icons generated.')
