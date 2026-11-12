"""Builds src/pack-2026-11c.json: 20 more celebrity cards (Set 6 women, Set 7 men). Usage: python3 -I tools/build_pack_c.py <out.json>"""
import base64, io, json, sys
from PIL import Image
UP = "/mnt/user-data/uploads/"
# slug, name, kanji, reading, prefecture, sex, photo hash(es), [facts]
P = [
 ("takuya-kimura","Takuya Kimura","木村 拓哉","きむら たくや","tokyo","M",["5d4c17eb"],["Set 7","SMAP member; star of HERO"]),
 ("yutaka-takenouchi","Yutaka Takenouchi","竹野内 豊","たけのうち ゆたか","saitama","M",["66caba94"],["Set 7","From Tokorozawa, Saitama; Beach Boys"]),
 ("kento-yamazaki","Kento Yamazaki","山﨑 賢人","やまざき けんと","tokyo","M",["120dfe08"],["Set 7","Kingdom, Alice in Borderland"]),
 ("toma-ikuta","Toma Ikuta","生田 斗真","いくた とうま","hokkaido","M",["196e721d"],["Set 7","From Muroran/Noboribetsu, Hokkaido; Hana-Kimi"]),
 ("ryoma-takeuchi","Ryoma Takeuchi","竹内 涼真","たけうち りょうま","tokyo","M",["cf75cef0"],["Set 7","From Machida, Tokyo; Kamen Rider Drive"]),
 ("takeshi-kitano","Takeshi Kitano","北野 武","きたの たけし","tokyo","M",["1e51fd83"],["Set 7","From Adachi, Tokyo; known as Beat Takeshi"]),
 ("mamoru-miyano","Mamoru Miyano","宮野 真守","みやの まもる","saitama","M",["a183b09d"],["Set 7","Voice actor; voiced Light Yagami in Death Note"]),
 ("kei-tanaka","Kei Tanaka","田中 圭","たなか けい","tokyo","M",["949d7255"],["Set 7","Ossan's Love"]),
 ("kentaro-sakaguchi","Kentaro Sakaguchi","坂口 健太郎","さかぐち けんたろう","tokyo","M",["1b8668ee"],["Set 7","From Fuchu, Tokyo; MEN'S NON-NO, Signal"]),
 ("kazunari-ninomiya","Kazunari Ninomiya","二宮 和也","にのみや かずなり","tokyo","M",["a9bf24f9"],["Set 7","From Katsushika, Tokyo; Arashi member; Letters from Iwo Jima"]),
 ("satomi-ishihara","Satomi Ishihara","石原 さとみ","いしはら さとみ","tokyo","F",["c4783575"],["Set 6","Unnatural, Pretty Proofreader"]),
 ("kyoko-fukada","Kyoko Fukada","深田 恭子","ふかだ きょうこ","tokyo","F",["a43199d0"],["Set 6","Kamikaze Girls, Lupin's Daughter"]),
 ("yuko-araki","Yuko Araki","新木 優子","あらき ゆうこ","tokyo","F",["90df728c"],["Set 6","Code Blue"]),
 ("mirei-kiritani","Mirei Kiritani","桐谷 美玲","きりたに みれい","chiba","F",["2c9ad1e7"],["Set 6","Seventeen model; NEWS ZERO"]),
 ("minami-hamabe","Minami Hamabe","浜辺 美波","はまべ みなみ","ishikawa","F",["14a394ce"],["Set 6","Godzilla Minus One"]),
 ("tsubasa-honda","Tsubasa Honda","本田 翼","ほんだ つばさ","tokyo","F",["68612cdb"],["Set 6"]),
 ("juri-ueno","Juri Ueno","上野 樹里","うえの じゅり","hyogo","F",["79cea453"],["Set 6","From Kakogawa, Hyogo; Nodame Cantabile"]),
 ("mikako-tabe","Mikako Tabe","多部 未華子","たべ みかこ","tokyo","F",["2253a0b4","791e27d1"],["Set 6","My Housekeeper Nagisa-san, Tsubasa","Long hair is the memory trigger (second photo)"]),
 ("yuriko-yoshitaka","Yuriko Yoshitaka","吉高 由里子","よしたか ゆりこ","tokyo","F",["7e113b93"],["Set 6","Dear Radiance (2024 NHK)"]),
 ("aoi-miyazaki","Aoi Miyazaki","宮﨑 あおい","みやざき あおい","tokyo","F",["033e661d"],["Set 6","Atsuhime. Her surname is not a link to Miyazaki Prefecture"]),
]
def photo(h):
    im = Image.open(f"{UP}{h}-image.jpg").convert("RGB"); im.thumbnail((440, 440))
    b = io.BytesIO(); im.save(b, "JPEG", quality=80, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()
items = []
for i, (slug, name, kj, rd, pref, sex, hs, facts) in enumerate(P):
    ph = [photo(h) for h in hs]
    it = {"id": f"person-{slug}", "templateId": "t-person", "created": 1700000200000 + i, "updated": 1700000200000 + i, "mnemonic": "",
      "values": {"photo": ph[0], "kanji": kj, "reading": rd, "name": name, "prefecture": f"pref-{pref}", "sex": sex},
      "facts": [{"id": f"c{i}-{j}", "text": t, "date": "2026-11-12", "source": "list"} for j, t in enumerate(facts)]}
    if len(ph) > 1: it["photos"] = {"photo": ph[1:]}
    items.append(it)
json.dump({"id": "pack-2026-11c", "items": items}, open(sys.argv[1], "w"), ensure_ascii=False, separators=(",", ":"))
print(len(items), "cards,", len(open(sys.argv[1]).read()) // 1024, "KB")
