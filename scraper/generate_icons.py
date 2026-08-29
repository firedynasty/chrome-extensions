from PIL import Image, ImageDraw

for size in (48, 128):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # dark background circle
    d.ellipse([2, 2, size - 3, size - 3], fill=(26, 26, 46, 255))
    # simple downward arrow
    cx, cy = size // 2, size // 2
    aw = size // 3
    ah = size // 3
    shaft_w = max(2, size // 10)
    # shaft
    d.rectangle([cx - shaft_w, cy - ah // 2, cx + shaft_w, cy + ah // 4], fill=(171, 71, 188, 255))
    # arrowhead
    d.polygon([
        (cx - aw // 2, cy + ah // 4),
        (cx + aw // 2, cy + ah // 4),
        (cx,           cy + ah // 2 + ah // 4),
    ], fill=(171, 71, 188, 255))
    img.save(f"icon{size}.png")
    print(f"icon{size}.png written")
