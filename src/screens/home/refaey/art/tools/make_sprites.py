#!/usr/bin/env python3
"""
Refaey sprite pipeline: three 3D-render contact sheets -> clean animation strips (WebP with alpha) + two busts.

  python3 src/screens/home/refaey/art/tools/make_sprites.py [--preview DIR]

Input  (art/source/):  idle-sheet.png (8 frames, 2x4), walk-sheet.png (12, 3x4), hop-sheet.png (12, 3x4). RGBA, cut out
                       already but WhatsApp-compressed: soft low-alpha white speckle around the suit and colour fringing.
Output (art/):         idle-strip.webp, walk-strip.webp, hop-strip.webp, bust-80.webp, bust-160.webp, sprites.json,
                       tools/last-run.json (measurements). Contact sheets go to --preview (outside the repo).

Steps per sheet
  1. frames = connected components of the alpha mask (not a fixed grid), row-major; the count must match or we stop.
  2. clean: alpha re-thresholded and softened to a 1 px edge, then the colour of the outer 4 px is replaced by the nearest
     colour from deeper inside the suit (removes fringes); stray specks are dropped with the component filter.
  3. normalise: ONE scale per sheet (never per frame), chosen so the face is the same size in every sheet; every frame sits
     on a common canvas with its feet on the same baseline and its torso centre on the same x.
  4. measure: halo budget (bright edge pixels on #000) and helmet-centre drift across the idle frames.
"""
import argparse, json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

HERE = Path(__file__).resolve().parent
ART = HERE.parent
SRC = ART / 'source'
SHEETS = {'idle': dict(file='idle-sheet.png', frames=8, rows=2), 'walk': dict(file='walk-sheet.png', frames=12, rows=3), 'hop': dict(file='hop-sheet.png', frames=12, rows=3)}
ALPHA_LO, ALPHA_HI = 40, 235          # alpha below LO is background, above HI is solid
HALO_BUDGET = 0.005                    # share of outer-edge pixels
DRIFT_BUDGET_PX = 2.0                  # helmet-centre drift across idle frames, at display size
DISPLAY_H = 440                        # CSS px: the tallest the sprite is shown
FEATHER_SIGMA = 1.3                    # edge softness (px): a ~2 px anti-aliased rim, so the outermost pixels are partly transparent
WEBP_QUALITY = 85
MAX_STRIP_KB = 350


def lum(rgb):  # relative luminance of sRGB 0..255 (approx, gamma ignored: a conservative proxy)
    return (0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]) / 255.0


def find_frames(rgba, expected, rows):
    a = rgba[..., 3]
    lab, k = ndi.label(a > ALPHA_LO)
    sizes = ndi.sum(a > ALPHA_LO, lab, range(1, k + 1))
    keep = [i + 1 for i, s in enumerate(sizes) if s > 3000]
    if len(keep) != expected:
        sys.exit(f'STOP: found {len(keep)} frames, expected {expected}')
    boxes = {i: ndi.find_objects(lab == i)[0] for i in keep}
    cy = {i: (boxes[i][0].start + boxes[i][0].stop) / 2 for i in keep}
    # row-major: cluster into rows by centre y, then sort by x
    order = sorted(keep, key=lambda i: cy[i])
    per = expected // rows
    out = []
    for r in range(rows):
        row = sorted(order[r * per:(r + 1) * per], key=lambda i: boxes[i][1].start)
        out += row
    return lab, out, boxes


def clean(rgba, lab, idx, box, pad=10):
    y0, y1 = max(box[0].start - pad, 0), min(box[0].stop + pad, rgba.shape[0])
    x0, x1 = max(box[1].start - pad, 0), min(box[1].stop + pad, rgba.shape[1])
    crop = rgba[y0:y1, x0:x1].astype(np.float32)
    own = (lab[y0:y1, x0:x1] == idx)
    a = crop[..., 3]
    # solid inside the component, dropped outside it (stray specks); soft 1 px edge
    solid = np.clip((a - ALPHA_LO) / (ALPHA_HI - ALPHA_LO), 0, 1) * own
    inner = ndi.binary_erosion(solid > 0.5, iterations=1)
    soft = ndi.gaussian_filter(inner.astype(np.float32), FEATHER_SIGMA)
    alpha = np.clip(soft, 0, 1)
    # colour decontamination: the outer ring takes the nearest colour from well inside the suit
    deep = ndi.binary_erosion(solid > 0.5, iterations=4)
    _, (iy, ix) = ndi.distance_transform_edt(~deep, return_indices=True)
    rgb = crop[..., :3].copy()
    ring = ~ndi.binary_erosion(solid > 0.5, iterations=4)
    rgb[ring] = crop[iy[ring], ix[ring], :3]
    # final: premultiplied-safe RGB, alpha 0..255
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    return out


def face_mask(rgb, alpha):
    r, g, b = [rgb[..., i].astype(np.float32) for i in range(3)]
    mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    sat = (mx - mn) / np.maximum(mx, 1)
    v = mx / 255.0
    return (alpha > 128) & (r > g) & (g >= b - 4) & (sat > 0.25) & (v < 0.72)


def face_stats(frame):
    m = face_mask(frame[..., :3], frame[..., 3])
    ys, xs = np.nonzero(m)
    if len(xs) < 50:
        return None
    return dict(area=float(m.sum()), cx=float(xs.mean()), cy=float(ys.mean()), top=float(np.percentile(ys, 2)))


def helmet_cx(frame, frac=0.26):
    """Centre x of the helmet's bounding box: the top quarter of the figure."""
    a = frame[..., 3] > 128
    ys = np.nonzero(a.any(1))[0]
    y0, h = ys[0], ys[-1] - ys[0]
    xs = np.nonzero(a[y0:int(y0 + frac * h)].any(0))[0]
    return float((xs[0] + xs[-1]) / 2)


def torso_cx(frame):
    a = frame[..., 3] > 128
    ys = np.nonzero(a.any(1))[0]
    y0, y1 = ys[0], ys[-1]
    h = y1 - y0
    band = a[int(y0 + 0.38 * h): int(y0 + 0.62 * h)]
    xs = np.nonzero(band.any(0))[0]
    return float((xs[0] + xs[-1]) / 2)


def halo(frame):
    """Outer 2 px of the alpha mask, composited on #000. Returns (literal share >0.85, share brighter than the suit just inside)."""
    a = frame[..., 3] / 255.0
    rgb = frame[..., :3].astype(np.float32) * a[..., None]
    L = lum(rgb)
    m = frame[..., 3] > 128
    ring = m & ~ndi.binary_erosion(m, iterations=2)
    band = ndi.binary_erosion(m, iterations=2) & ~ndi.binary_erosion(m, iterations=7)
    n = int(ring.sum())
    literal = float((L[ring] > 0.85).sum()) / n
    # "halo" = the edge is brighter than the suit just under it (a fringe), not merely light because the suit is light
    ref = ndi.maximum_filter(np.where(band, L, 0), size=9)
    fringe = float(((L > 0.85) & (L > ref + 0.06) & ring).sum()) / n
    return literal, fringe, n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', default=str(Path.home() / 'Developer/Al-Ostora-shots/refaey-story/art'))
    args = ap.parse_args()
    prev = Path(args.preview)
    prev.mkdir(parents=True, exist_ok=True)

    raw = {}
    for name, cfg in SHEETS.items():
        rgba = np.array(Image.open(SRC / cfg['file']).convert('RGBA'))
        lab, order, boxes = find_frames(rgba, cfg['frames'], cfg['rows'])
        frames = [clean(rgba, lab, i, boxes[i]) for i in order]
        raw[name] = frames
        print(f'{name}: {len(frames)} frames')

    # one scale per sheet: the median face size is matched to the idle sheet's
    face = {n: float(np.median([s['area'] for s in map(face_stats, fr) if s])) for n, fr in raw.items()}
    scale = {n: float(np.sqrt(face['idle'] / face[n])) for n in raw}
    print('face area', {k: int(v) for k, v in face.items()}, 'scale', {k: round(v, 3) for k, v in scale.items()})

    report = dict(scale=scale, sheets={})
    sprites = {}
    contact = {}
    for name, frames in raw.items():
        s = scale[name]
        scaled = [np.array(Image.fromarray(f).resize((max(1, round(f.shape[1] * s)), max(1, round(f.shape[0] * s))), Image.LANCZOS)) for f in frames]
        # trim each frame to its opaque bbox, then place on a common canvas: feet baseline, torso centre
        trimmed, tcx = [], []   # tcx: the x anchor of each frame
        for f in scaled:
            ys, xs = np.nonzero(f[..., 3] > 8)
            f = f[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
            trimmed.append(f)
            # anchor = halfway between the chest centre and the helmet's bounding-box centre, so the residual sway is shared
            # between the body and the head instead of all landing on one of them
            tcx.append((torso_cx(f) + helmet_cx(f)) / 2)
        left = max(tcx)
        right = max(f.shape[1] - c for f, c in zip(trimmed, tcx))
        W, H = int(np.ceil(left + right)) + 8, max(f.shape[0] for f in trimmed) + 8
        canvas = []
        for f, c in zip(trimmed, tcx):
            cv = np.zeros((H, W, 4), np.uint8)
            x0 = int(round(left - c)) + 4
            y0 = H - f.shape[0] - 4          # feet on the baseline
            cv[y0:y0 + f.shape[0], x0:x0 + f.shape[1]] = f
            canvas.append(cv)
        # measurements
        hl = [halo(c) for c in canvas]
        literal = float(np.mean([h[0] for h in hl]))
        fringe = float(np.mean([h[1] for h in hl]))
        helm = [helmet_cx(c) for c in canvas]
        torso = [torso_cx(c) for c in canvas]
        drift_native = float(max(helm) - min(helm))
        torso_native = float(max(torso) - min(torso))
        display_scale = DISPLAY_H / H
        drift_px = drift_native * display_scale
        strip = np.concatenate(canvas, axis=1)
        img = Image.fromarray(strip, 'RGBA')
        out = ART / f'{name}-strip.webp'
        img.save(out, 'WEBP', quality=WEBP_QUALITY, method=6, alpha_quality=90)
        kb = out.stat().st_size / 1024
        report['sheets'][name] = dict(frames=len(canvas), frame_w=W, frame_h=H, strip_kb=round(kb, 1),
                                      halo_literal_pct=round(literal * 100, 2), halo_fringe_pct=round(fringe * 100, 3),
                                      helmet_drift_native_px=round(drift_native, 2), helmet_drift_display_px=round(drift_px, 2), torso_drift_display_px=round(torso_native * display_scale, 2),
                                      halo_ok=fringe <= HALO_BUDGET, drift_ok=(drift_px <= DRIFT_BUDGET_PX) if name == 'idle' else None,
                                      size_ok=kb <= MAX_STRIP_KB)
        # anchorX: where the chest/helmet anchor sits inside a frame, so different strips can be lined up in one box; the feet are 4 px above the bottom
        sprites[name] = dict(frameW=W, frameH=H, count=len(canvas), anchorX=int(round(left)) + 4)
        contact[name] = canvas
        print(name, report['sheets'][name])

    # busts: head and shoulders of idle frame 1, square
    f0 = contact['idle'][0]
    st = face_stats(f0)
    ys, xs = np.nonzero(f0[..., 3] > 128)
    top = ys[0]
    side = int(0.40 * (ys[-1] - ys[0]))
    cx = int(round(st['cx']))
    x0 = max(0, min(f0.shape[1] - side, cx - side // 2))
    bust = Image.fromarray(f0[top - 4 if top > 4 else 0: (top - 4 if top > 4 else 0) + side, x0:x0 + side], 'RGBA')
    for px in (80, 160):
        bust.resize((px, px), Image.LANCZOS).save(ART / f'bust-{px}.webp', 'WEBP', quality=90, method=6, alpha_quality=95)
    report['busts'] = {px: round((ART / f'bust-{px}.webp').stat().st_size / 1024, 1) for px in (80, 160)}
    report['total_kb'] = round(sum((ART / f'{n}-strip.webp').stat().st_size for n in raw) / 1024 + sum(report['busts'].values()), 1)
    (ART / 'sprites.json').write_text(json.dumps({**sprites, 'displayHeight': DISPLAY_H}, indent=2) + '\n')
    (HERE / 'last-run.json').write_text(json.dumps(report, indent=2) + '\n')

    # contact sheets (outside the repo): on #000 and on the page's surface colour
    for bg_name, bg in (('black', (0, 0, 0)), ('surface', (11, 11, 12))):
        rows = []
        for name, canvas in contact.items():
            strip = np.concatenate(canvas, axis=1)
            im = Image.new('RGBA', (strip.shape[1], strip.shape[0]), bg + (255,))
            im.alpha_composite(Image.fromarray(strip, 'RGBA'))
            rows.append(im.convert('RGB'))
        Wmax = max(r.width for r in rows)
        sheet = Image.new('RGB', (Wmax, sum(r.height for r in rows) + 10 * len(rows)), bg)
        y = 0
        for r in rows:
            sheet.paste(r, (0, y)); y += r.height + 10
        sheet.save(prev / f'contact-{bg_name}.png')
    print('total KB', report['total_kb'], '| contact sheets in', prev)


if __name__ == '__main__':
    main()
