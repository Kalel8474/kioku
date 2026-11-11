"""Builds src/seed.json: templates + 30 card items + 47 prefecture items.
Usage: python3 -I tools/build_seed.py <prefecture.geojson> <out.json>
Photo paths are the uploaded files; edit PHOTOS below if they move.
"""
import base64, io, json, math, sys
from urllib.parse import quote
from PIL import Image

GEO, OUT = sys.argv[1], sys.argv[2]
UP = "/mnt/user-data/uploads/"
TODAY = "2026-11-10"

EN = "Hokkaido Aomori Iwate Miyagi Akita Yamagata Fukushima Ibaraki Tochigi Gunma Saitama Chiba Tokyo Kanagawa Niigata Toyama Ishikawa Fukui Yamanashi Nagano Gifu Shizuoka Aichi Mie Shiga Kyoto Osaka Hyogo Nara Wakayama Tottori Shimane Okayama Hiroshima Yamaguchi Tokushima Kagawa Ehime Kochi Fukuoka Saga Nagasaki Kumamoto Oita Miyazaki Kagoshima Okinawa".split()
KANJI = "北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県".split()
BASE = "ほっかいどう あおもり いわて みやぎ あきた やまがた ふくしま いばらき とちぎ ぐんま さいたま ちば とうきょう かながわ にいがた とやま いしかわ ふくい やまなし ながの ぎふ しずおか あいち みえ しが きょう おおさか ひょうご なら わかやま とっとり しまね おかやま ひろしま やまぐち とくしま かがわ えひめ こうち ふくおか さが ながさき くまもと おおいた みやざき かごしま おきなわ".split()
assert len(EN) == len(KANJI) == len(BASE) == 47

def reading(i):
    k = KANJI[i]
    suf = "" if k.endswith("道") else {"都": "と", "府": "ふ"}.get(k[-1], "けん")
    return BASE[i] + suf

# name, kanji, reading, prefecture (English), photo hash, bullets (printed on the card)
PEOPLE = [
 ("Yuzuru Hanyu","羽生 結弦","はにゅう ゆづる","Miyagi","503cd4a8",["Sendai-born","Exceptionally strong Miyagi connection"]),
 ("Yo Oizumi","大泉 洋","おおいずみ よう","Hokkaido","fa3e936b",["Born in Ebetsu","Strongly associated with Hokkaido"]),
 ("Shun Oguri","小栗 旬","おぐり しゅん","Tokyo","97311521",["Tokyo-born"]),
 ("Takeru Satoh","佐藤 健","さとう たける","Saitama","54c99f8b",["Saitama-born"]),
 ("Sanma Akashiya","明石家 さんま","あかしや さんま","Nara","510f84bc",["Born in Wakayama","Grew up in Nara","Kansai connection"]),
 ("Suzu Hirose","広瀬 すず","ひろせ すず","Shizuoka","30b231ef",["Shizuoka-born"]),
 ("Kanna Hashimoto","橋本 環奈","はしもと かんな","Fukuoka","b4a97564",["Fukuoka-born","Began her entertainment career there"]),
 ("Haruka Ayase","綾瀬 はるか","あやせ はるか","Hiroshima","b2561f6e",["Hiroshima-born"]),
 ("Ko Shibasaki","柴咲 コウ","しばさき こう","Tokyo","7acecfe9",["Tokyo-born"]),
 ("Yukie Nakama","仲間 由紀恵","なかま ゆきえ","Okinawa","e29f9cc6",["Born in Urasoe, Okinawa","Very strong Okinawan identity"]),
 ("Yudai Chiba","千葉 雄大","ちば ゆうだい","Miyagi","0a173962",["Sendai-born","Known for his Miyagi roots"]),
 ("Ken Yasuda","安田 顕","やすだ けん","Hokkaido","6e5a747e",["Born in Sapporo, Hokkaido","Strong Hokkaido identity"]),
 ("Hiroshi Abe","阿部 寛","あべ ひろし","Kanagawa","4cda9f5b",["Born in Yokohama, Kanagawa","Long association with the region"]),
 ("Ken Watanabe","渡辺 謙","わたなべ けん","Niigata","42b37f03",["Born in Niigata","Often speaks about his hometown"]),
 ("Masami Nagasawa","長澤 まさみ","ながさわ まさみ","Shizuoka","744c3f21",["Shizuoka-born","Strong local connection"]),
 ("Ichiro Suzuki","イチロー","イチロー","Aichi","3612d8e9",["Born in Kasugai, Aichi","One of Japan's most famous athletes"]),
 ("Masato Sakai","堺 雅人","さかい まさと","Miyazaki","964e37d7",["Born in Miyazaki City","Frequently speaks about his Miyazaki roots"]),
 ("Haruna Kawaguchi","川口 春奈","かわぐち はるな","Nagasaki","dc0c04e6",["Born in Nagasaki","Often mentions her hometown"]),
 ("Hiroshi Tamaki","玉木 宏","たまき ひろし","Aichi","11461d7b",["Born in Nagoya, Aichi","Actor and singer with strong Aichi ties"]),
 ("Fumi Nikaido","二階堂 ふみ","にかいどう ふみ","Okinawa","69f98985",["Born in Okinawa","Strong Okinawan identity"]),
 ("Tao Tsuchiya","土屋 太鳳","つちや たお","Yamagata","e1eac62f",["Born in Yamagata City","Strong local connection"]),
 ("Orin","王林","おうりん","Aomori","23dc83ff",["Born in Aomori City","Local celebrity and entertainer"]),
 ("Tomoya Nakamura","中村 倫也","なかむら ともや","Chiba","59db33e2",["Born in Chiba","Popular actor"]),
 ("Go Ayano","綾野 剛","あやの ごう","Ibaraki","c1cdb916",["Born in Ibaraki","Known for many popular dramas"]),
 ("Jun Matsumoto","松本 潤","まつもと じゅん","Ishikawa","a0c4ab60",["Born in Kanazawa, Ishikawa","Member of ARASHI"]),
 ("Yui Aragaki","新垣 結衣","あらがき ゆい","Nagano","696eeca4",["Born in Nagano","One of Japan's most popular actresses"]),
 ("Keiko Kitagawa","北川 景子","きたがわ けいこ","Hyogo","e5022e29",["Born in Kobe, Hyogo","Kobe / Kansai anchor"]),
 ("Koji Seto","瀬戸 康史","せと こうじ","Fukuoka","a7c79701",["From Kama City, Fukuoka","Kamen Rider Kiva actor","SETO x KAMA hometown project"]),
 ("Kasumi Arimura","有村 架純","ありむら かすみ","Kagoshima","ad689dc0",["Born in Kagoshima City","Popular actress"]),
 ("Haruma Miura","三浦 春馬","みうら はるま","Kochi","2dee09ae",["Born in Kochi City","Beloved actor"]),
]

# ---------- silhouettes ----------
def rdp(pts, eps):
    if len(pts) < 3: return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1e-12
    dmax, idx = 0, 0
    for i in range(1, len(pts) - 1):
        d = abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / L
        if d > dmax: dmax, idx = d, i
    if dmax > eps:
        return rdp(pts[:idx + 1], eps)[:-1] + rdp(pts[idx:], eps)
    return [pts[0], pts[-1]]

def ring_area(r):
    return abs(sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1))) / 2

def keep(name, ring):
    xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
    cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
    if name == "Tokyo" and cy < 34.5: return False      # keep mainland + nearest Izu island only
    if name == "Okinawa" and not (126.0 <= cx <= 128.6): return False  # main island group only
    return True

def silhouette(feat):
    name = feat["properties"]["name"]
    g = feat["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    rings = []
    for p in polys:
        if not keep(name, p[0]): continue
        for k, r in enumerate(p):
            rings.append((k == 0, r))
    biggest = max(ring_area(r) for outer, r in rings if outer)
    rings = [(o, r) for o, r in rings if (not o) or ring_area(r) >= max(biggest * 0.0015, 0.0006)]
    lat0 = sum(p[1] for o, r in rings if o for p in r) / sum(len(r) for o, r in rings if o)
    c = math.cos(math.radians(lat0))
    proj = [[(x * c, -y) for x, y in r] for o, r in rings]
    xs = [p[0] for r in proj for p in r]; ys = [p[1] for r in proj for p in r]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    s = 88 / max(w, h)
    ox = (100 - w * s) / 2 - min(xs) * s; oy = (100 - h * s) / 2 - min(ys) * s
    d = []
    for r in proj:
        q = [(x * s + ox, y * s + oy) for x, y in r]
        if q[0] == q[-1]: q = q[:-1]
        # closed ring: split at the point farthest from the start so RDP has a real baseline
        k = max(range(len(q)), key=lambda i: (q[i][0] - q[0][0]) ** 2 + (q[i][1] - q[0][1]) ** 2)
        pts = rdp(q[:k + 1], 0.22)[:-1] + rdp(q[k:] + [q[0]], 0.22)[:-1]
        if len(pts) < 3: continue
        d.append("M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + "Z")
    svg = ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path fill-rule='evenodd' "
           "fill='#86c35f' stroke='#1d2b17' stroke-width='1.1' stroke-linejoin='round' d='" + "".join(d) + "'/></svg>")
    return "data:image/svg+xml;utf8," + quote(svg, safe="/:=,' ")

geo = json.load(open(GEO))
sil = {f["properties"]["id"]: silhouette(f) for f in geo["features"]}
assert len(sil) == 47

def photo(h):
    im = Image.open(f"{UP}{h}-image.jpg").convert("RGB")
    im.thumbnail((440, 440))
    b = io.BytesIO(); im.save(b, "JPEG", quality=80, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()

T_PREF, T_PERS = "t-prefecture", "t-person"
templates = [
  {"id": T_PREF, "name": "Prefecture", "titleKey": "name", "facets": [
    {"key": "silhouette", "label": "Silhouette", "type": "image"},
    {"key": "kanji", "label": "Kanji", "type": "kanji"},
    {"key": "reading", "label": "Reading", "type": "reading"},
    {"key": "name", "label": "Name", "type": "text"}]},
  {"id": T_PERS, "name": "Person", "titleKey": "name", "facets": [
    {"key": "photo", "label": "Photo", "type": "image"},
    {"key": "kanji", "label": "Kanji", "type": "kanji"},
    {"key": "reading", "label": "Reading", "type": "reading"},
    {"key": "name", "label": "Name", "type": "text"},
    {"key": "prefecture", "label": "Prefecture", "type": "link", "linkTemplate": T_PREF}]},
]

def slug(s): return "".join(ch.lower() if ch.isalnum() else "-" for ch in s).strip("-")
pid = {en: f"pref-{slug(en)}" for en in EN}
items, t = [], 1_700_000_000_000
for n, (name, kj, rd, pref, h, bullets) in enumerate(PEOPLE):
    t += 1
    items.append({"id": f"person-{slug(name)}", "templateId": T_PERS, "created": t, "updated": t, "mnemonic": "",
        "values": {"photo": photo(h), "kanji": kj, "reading": rd, "name": name, "prefecture": pid[pref]},
        "facts": [{"id": f"f{n}-{i}", "text": b, "date": TODAY, "source": "card"} for i, b in enumerate(bullets)]})
for i, en in enumerate(EN):
    t += 1
    items.append({"id": pid[en], "templateId": T_PREF, "created": t, "updated": t, "mnemonic": "", "facts": [],
        "values": {"silhouette": sil[f"JP{i+1:02d}"], "kanji": KANJI[i], "reading": reading(i), "name": en}})
assert all(pid[p[3]] for p in PEOPLE)
json.dump({"templates": templates, "items": items}, open(OUT, "w"), ensure_ascii=False)
print("items", len(items), "bytes", len(open(OUT, encoding="utf8").read()))
