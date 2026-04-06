import os
import sys
from PIL import Image, ImageStat


def dominant_colors(image, top_k=3):
    reduced = image.convert('RGB').resize((96, 96))
    quantized = reduced.quantize(colors=6, method=Image.Quantize.MEDIANCUT)
    palette = quantized.getpalette() or []
    color_counts = sorted(quantized.getcolors() or [], reverse=True)

    colors = []
    for _, idx in color_counts[:top_k]:
        base = idx * 3
        r, g, b = palette[base:base + 3]
        colors.append(f"rgb({r}, {g}, {b})")
    return colors


def brightness_band(image):
    avg = ImageStat.Stat(image.convert('L')).mean[0]
    if avg < 65:
        return 'dark'
    if avg < 140:
        return 'balanced'
    return 'bright'


def local_caption(image):
    width, height = image.size
    if width > height:
        orientation = 'landscape'
    elif height > width:
        orientation = 'portrait'
    else:
        orientation = 'square'

    colors = dominant_colors(image)
    color_text = ', '.join(colors) if colors else 'mixed tones'

    return (
        f"This is a {orientation} image with resolution {width}x{height}. "
        f"Overall lighting appears {brightness_band(image)}. "
        f"Dominant color tones are {color_text}."
    )


def main():
    if len(sys.argv) < 2:
        print('Image file path is required.', file=sys.stderr)
        return 1

    image_path = sys.argv[1]
    if not os.path.exists(image_path):
        print('Image file does not exist.', file=sys.stderr)
        return 1

    try:
        image = Image.open(image_path).convert('RGB')
    except Exception as exc:
        print(f"Error reading image: {str(exc)}", file=sys.stderr)
        return 1

    print(local_caption(image), flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
