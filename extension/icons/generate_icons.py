"""
One-off script to rasterize a simplified Ascend mark into PNG icons
(16/48/128px) for the Chrome extension. Adapts public/favicon.svg's
checkmark-arrow glyph (dark rounded-square bg, cyan/violet gradient
stroke) into a flat two-tone version that stays legible at 16px.

Run once with: python generate_icons.py
Requires Pillow (already available in this environment).
"""

from PIL import Image, ImageDraw

BG = (7, 9, 13, 255)  # #07090D, matches favicon.svg background
CYAN = (34, 211, 238, 255)  # #22d3ee
VIOLET = (167, 139, 250, 255)  # #a78bfa

SIZE = 512  # render large, downsample for crisp edges at small sizes
SCALE = SIZE / 40.0  # favicon.svg viewBox is 40x40


def lerp(a, b, t):
    return a + (b - a) * t


def gradient_color(t):
    return tuple(int(lerp(CYAN[i], VIOLET[i], t)) for i in range(4))


def draw_thick_polyline(draw, points, width, color):
    """Draw a polyline with round joins/caps by stacking line segments + joint circles."""
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        draw.line([(x0, y0), (x1, y1)], fill=color, width=width)
    r = width / 2
    for (x, y) in points:
        draw.ellipse([x - r, y - r, x + r, y + r], fill=color)


def render(size):
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded-square background, radius 9/40 of viewBox.
    radius = 9 * SCALE
    draw.rounded_rectangle([0, 0, SIZE, SIZE], radius=radius, fill=BG)

    stroke_w = round(4.75 * SCALE)

    # Path 1: checkmark leading into arrow shaft — "M7 30 L16.5 19.5 L22 24 L32 11"
    p1 = [(7, 30), (16.5, 19.5), (22, 24), (32, 11)]
    p1 = [(x * SCALE, y * SCALE) for x, y in p1]
    draw_thick_polyline(draw, p1, stroke_w, CYAN)

    # Path 2: arrowhead — "M32 11 L23.5 11 M32 11 L32 19.5"
    p2a = [(32, 11), (23.5, 11)]
    p2b = [(32, 11), (32, 19.5)]
    p2a = [(x * SCALE, y * SCALE) for x, y in p2a]
    p2b = [(x * SCALE, y * SCALE) for x, y in p2b]
    draw_thick_polyline(draw, p2a, stroke_w, VIOLET)
    draw_thick_polyline(draw, p2b, stroke_w, VIOLET)

    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    for s in (16, 48, 128):
        out = render(s)
        out.save(f"icon{s}.png")
        print(f"wrote icon{s}.png ({out.size[0]}x{out.size[1]})")
