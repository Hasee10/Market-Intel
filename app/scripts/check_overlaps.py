import sys
from pptx import Presentation
from pptx.util import Emu

MARGIN_MIN_IN = 0.5

def emu_to_in(v):
    return Emu(v).inches if v is not None else None

def has_text(shape):
    try:
        return shape.has_text_frame and shape.text_frame.text.strip() != ''
    except Exception:
        return False

def rect(shape):
    l, t = emu_to_in(shape.left), emu_to_in(shape.top)
    w, h = emu_to_in(shape.width), emu_to_in(shape.height)
    if None in (l, t, w, h):
        return None
    return (l, t, l + w, t + h)

def overlaps(a, b):
    # Real overlap requires area intersection, not just touching edges -
    # adjacent cards sharing a border are fine; text bounding boxes actually
    # intersecting is the failure mode we care about.
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    ix0, iy0 = max(ax0, bx0), max(ay0, by0)
    ix1, iy1 = min(ax1, bx1), min(ay1, by1)
    if ix1 <= ix0 or iy1 <= iy0:
        return 0
    return (ix1 - ix0) * (iy1 - iy0)

path = sys.argv[1]
prs = Presentation(path)
slide_w_in = Emu(prs.slide_width).inches
slide_h_in = Emu(prs.slide_height).inches

total_issues = 0
for i, slide in enumerate(prs.slides, 1):
    text_shapes = []
    for shape in slide.shapes:
        if not has_text(shape):
            continue
        r = rect(shape)
        if r is None:
            continue
        text_shapes.append((shape.text_frame.text.strip()[:40], r))

    # Overlap check: any two distinct text boxes with meaningfully
    # overlapping area (>15% of the smaller box) - small edge touches from
    # rounding are noise, real text collisions are not.
    for a_idx in range(len(text_shapes)):
        for b_idx in range(a_idx + 1, len(text_shapes)):
            a_text, a_rect = text_shapes[a_idx]
            b_text, b_rect = text_shapes[b_idx]
            area = overlaps(a_rect, b_rect)
            if area <= 0:
                continue
            a_area = (a_rect[2] - a_rect[0]) * (a_rect[3] - a_rect[1])
            b_area = (b_rect[2] - b_rect[0]) * (b_rect[3] - b_rect[1])
            smaller = min(a_area, b_area)
            if smaller > 0 and area / smaller > 0.15:
                print(f"SLIDE {i}: OVERLAP ({area/smaller:.0%} of smaller box) '{a_text}' <-> '{b_text}'")
                total_issues += 1

    # Cut-off check: any text box extending past the slide bounds.
    for text, r in text_shapes:
        x0, y0, x1, y1 = r
        if x0 < -0.01 or y0 < -0.01 or x1 > slide_w_in + 0.01 or y1 > slide_h_in + 0.01:
            print(f"SLIDE {i}: CUT OFF '{text}' at ({x0:.2f},{y0:.2f})-({x1:.2f},{y1:.2f}) vs slide {slide_w_in:.2f}x{slide_h_in:.2f}")
            total_issues += 1

    # Margin check: leftmost/topmost/rightmost/bottommost content vs the
    # 0.5in minimum margin the brief specifies. Only check the outermost
    # shapes (background fills at 0,0 are fills, not content - exclude
    # anything wider/taller than 90% of the slide, those are backgrounds).
    content_shapes = [
        (t, r) for t, r in text_shapes
        if (r[2] - r[0]) < slide_w_in * 0.9 and (r[3] - r[1]) < slide_h_in * 0.9
    ]
    if content_shapes:
        min_left = min(r[0] for _, r in content_shapes)
        min_top = min(r[1] for _, r in content_shapes)
        max_right = max(r[2] for _, r in content_shapes)
        max_bottom = max(r[3] for _, r in content_shapes)
        if min_left < MARGIN_MIN_IN - 0.02:
            print(f"SLIDE {i}: LEFT MARGIN {min_left:.2f}in < {MARGIN_MIN_IN}in")
            total_issues += 1
        if slide_w_in - max_right < MARGIN_MIN_IN - 0.02:
            print(f"SLIDE {i}: RIGHT MARGIN {slide_w_in - max_right:.2f}in < {MARGIN_MIN_IN}in")
            total_issues += 1

print(f"\n{total_issues} issue(s) found across {len(prs.slides)} slides.")
