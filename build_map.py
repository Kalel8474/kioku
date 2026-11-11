"""Builds src/japanmap.json: all 47 prefectures in ONE shared coordinate system (so they sit side by side
like a real map), Okinawa moved into an inset box, plus the 8 standard regions with their view boxes.
Usage: python3 -I tools/build_map.py <prefecture.geojson> <out.json>
"""
import json, math, sys

GEO, OUT = sys.argv[1], sys.argv[2]
EN = "Hokkaido Aomori Iwate Miyagi Akita Yamagata Fukushima Ibaraki Tochigi Gunma Saitama Chiba Tokyo Kanagawa Niigata Toyama Ishikawa Fukui Yamanashi Nagano Gifu Shizuoka Aichi Mie Shiga Kyoto Osaka Hyogo Nara Wakayama Tottori Shimane Okayama Hiroshima Yamaguchi Tokushima Kagawa Ehime Kochi Fukuoka Saga Nagasaki Kumamoto Oita Miyazaki Kagoshima Okinawa".split()
REGIONS = {  # standard 8 regions; Kansai includes Mie
    "hokkaido": ("Hokkaido", "Hokkaido"),
    "tohoku": ("Tohoku", "Aomori Iwate Miyagi Akita Yamagata Fukushima"),
    "kanto": ("Kanto", "Ibaraki Tochigi Gunma Saitama Chiba Tokyo Kanagawa"),
    "chubu": ("Chubu", "Niigata Toyama Ishikawa Fukui Yamanashi Nagano Gifu Shizuoka Aichi"),
    "kansai": ("Kansai", "Mie Shiga Kyoto Osaka Hyogo Nara Wakayama"),
    "chugoku": ("Chugoku", "Tottori Shimane Okayama Hiroshima Yamaguchi"),
    "shikoku": ("Shikoku", "Tokushima Kagawa Ehime Kochi"),
    "kyushu": ("Kyushu & Okinawa", "Fukuoka Saga Nagasaki Kumamoto Oita Miyazaki Kagoshima Okinawa"),
}
S = 30.0                       # drawing units per degree of latitude
C = math.cos(math.radians(37))  # longitude squeeze at Japan's latitude
OKI_SHIFT = (-3.4, 5.8)         # degrees: moves Okinawa into an inset west of Kyushu

def rdp(pts, eps):
    if len(pts) < 3: return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1e-12
    dmax, idx = 0, 0
    for i in range(1, len(pts) - 1):
        d = abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / L
        if d > dmax: dmax, idx = d, i
    return rdp(pts[:idx + 1], eps)[:-1] + rdp(pts[idx:], eps) if dmax > eps else [pts[0], pts[-1]]

def area(r): return abs(sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1))) / 2
def slug(s): return "".join(ch.lower() if ch.isalnum() else "-" for ch in s).strip("-")

def keep(name, ring):
    cx = sum(p[0] for p in ring) / len(ring); cy = sum(p[1] for p in ring) / len(ring)
    if name == "Tokyo" and cy < 34.5: return False
    if name == "Okinawa" and not (126.0 <= cx <= 128.6): return False
    return True

def bbox(rings):
    xs = [p[0] for r in rings for p in r]; ys = [p[1] for r in rings for p in r]
    return [min(xs), min(ys), max(xs), max(ys)]

prefs = {}
for f in sorted(json.load(open(GEO))["features"], key=lambda f: int(f["properties"]["id"][2:])):
    i = int(f["properties"]["id"][2:]) - 1; name = EN[i]
    g = f["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    outers = [p[0] for p in polys if keep(name, p[0])]
    holes = [h for p in polys if keep(name, p[0]) for h in p[1:]]
    biggest = max(area(r) for r in outers)
    outers = [r for r in outers if area(r) >= max(biggest * 0.0015, 0.0006)]
    sx, sy = OKI_SHIFT if name == "Okinawa" else (0, 0)
    conv = lambda r: [((x + sx) * C * S, -(y + sy) * S) for x, y in r]
    rings = [conv(r) for r in outers + holes]
    d = []
    for r in rings:
        q = r[:-1] if r[0] == r[-1] else r
        k = max(range(len(q)), key=lambda j: (q[j][0] - q[0][0]) ** 2 + (q[j][1] - q[0][1]) ** 2)
        pts = rdp(q[:k + 1], 0.35)[:-1] + rdp(q[k:] + [q[0]], 0.35)[:-1]
        if len(pts) >= 3: d.append("M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + "Z")
    main = conv(max(outers, key=area)); mb = bbox([main])
    prefs[f"pref-{slug(name)}"] = {"d": "".join(d), "bb": [round(v, 1) for v in bbox(rings)], "c": [round((mb[0] + mb[2]) / 2, 1), round((mb[1] + mb[3]) / 2, 1)]}

def vb(boxes, pad_frac=0.12, pad=8):
    x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes); x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
    p = max(x1 - x0, y1 - y0) * pad_frac + pad
    return [round(v, 1) for v in (x0 - p, y0 - p, x1 - x0 + 2 * p, y1 - y0 + 2 * p)]

oki = prefs["pref-okinawa"]["bb"]
inset = [round(v, 1) for v in (oki[0] - 7, oki[1] - 7, oki[2] - oki[0] + 14, oki[3] - oki[1] + 14)]
regions, region_of = {}, {}
for rid, (label, names) in REGIONS.items():
    ids = [f"pref-{slug(n)}" for n in names.split()]
    for p in ids: region_of[p] = rid
    regions[rid] = {"name": label, "ids": ids, "vb": vb([prefs[p]["bb"] for p in ids])}
assert len(region_of) == 47
for p, r in region_of.items(): prefs[p]["r"] = r
out = {"vb": vb([v["bb"] for v in prefs.values()], 0.03, 6), "inset": inset, "prefs": prefs, "regions": regions}
json.dump(out, open(OUT, "w"), separators=(",", ":"))
print("prefs", len(prefs), "bytes", len(open(OUT).read()), "viewBox", out["vb"])
