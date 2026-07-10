"""Generate cursive-bible extension icons."""
from PIL import Image, ImageDraw, ImageFont

def make_icon(size, path):
    img = Image.new('RGBA', (size, size), (45, 27, 0, 255))
    draw = ImageDraw.Draw(img)
    # Parchment circle
    margin = size // 8
    draw.ellipse([margin, margin, size - margin, size - margin], fill=(245, 240, 232, 255))
    # Draw a cursive "C" in the center
    font_size = int(size * 0.55)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Brush Script.ttf', font_size)
    except Exception:
        try:
            font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Snell Roundhand.ttf', font_size)
        except Exception:
            font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), 'C', font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) // 2 - bbox[0]
    y = (size - th) // 2 - bbox[1]
    draw.text((x, y), 'C', fill=(139, 69, 19, 255), font=font)
    img.save(path)

make_icon(48, 'icon48.png')
make_icon(128, 'icon128.png')
print('Icons generated.')
