"""Builds src/pack-2026-11b.json: 20 more celebrity cards (Cream Quiz / Itte Q!). Usage: python3 -I tools/build_pack.py <out.json>"""
import base64, io, json, re, sys
from PIL import Image
UP = "/mnt/user-data/uploads/"
# slug, name, kanji, reading, prefecture id, sex, photo hash, [facts]
P = [
 ("ayako-imoto","Ayako Imoto","イモト アヤコ","いもと あやこ","tottori","F","6a41e0e5",["Itte Q!","Born in Tottori. Her trademark exaggerated eyebrows and Itte Q! adventures make her a memorable anchor"]),
 ("daisuke-miyagawa","Daisuke Miyagawa","宮川 大輔","みやがわ だいすけ","kyoto","M","7c7f8f15",["Itte Q!","Kyoto-born. His enthusiastic festival adventures on Itte Q! are a strong recognition cue"]),
 ("miyuki-oshima","Miyuki Oshima","大島 美幸","おおしま みゆき","tochigi","F","bd00e8dd",["Itte Q!","From Otawara, Tochigi. One of the three members of 森三中 (Morisanchu)"]),
 ("tomoko-murakami","Tomoko Murakami","村上 知子","むらかみ ともこ","kanagawa","F","7e62e82a",["Itte Q!","From Yokohama. Another member of 森三中 (Morisanchu)"]),
 ("kazuko-kurosawa","Kazuko Kurosawa","黒沢 かずこ","くろさわ かずこ","ibaraki","F","b5ee4862",["Itte Q!","Born in Ibaraki. The third member of 森三中 (Morisanchu)"]),
 ("yuya-tegoshi","Yuya Tegoshi","手越 祐也","てごし ゆうや","kanagawa","M","3d4ca474",["Itte Q!","Born in Yokohama. His energetic Itte Q! appearances make him easy to associate with the show"]),
 ("teruyoshi-uchimura","Teruyoshi Uchimura","内村 光良","うちむら てるよし","kumamoto","M","13c7edc4",["Itte Q!","From Hitoyoshi, Kumamoto. The Itte Q! host"]),
 ("miho-watanabe","Miho Watanabe","渡邉 美穂","わたなべ みほ","saitama","F","4a0d9729",["Cream Quiz","Saitama-born actress and former Hinatazaka46 member"]),
 ("takashi-yoshimura","Takashi Yoshimura","吉村 崇","よしむら たかし","hokkaido","M","70a8d1d1",["Cream Quiz","From Sapporo. Member of 平成ノブシコブシ (Heisei Nobushikobushi)"]),
 ("first-summer-uika","First Summer Uika","ファースト サマーウイカ","ふぁーすと さまーういか","osaka","F","29635f8e",["Cream Quiz","Osaka-born. Her Kansai dialect and strong personality make her an excellent Osaka association"]),
 ("kazu-laser","Kazu Laser","カズレーザー","かずれーざー","saitama","M","06e0308d",["Cream Quiz","From Kazo City, Saitama; his trademark red clothing and blond hair make him an easy visual anchor"]),
 ("yoshizumi-ishihara","Yoshizumi Ishihara","石原 良純","いしはら よしずみ","kanagawa","M","1d4b6e50",["Cream Quiz","Kanagawa-born; familiar actor, weather presenter and quiz personality"]),
 ("atsuhiro-tsuda","Atsuhiro Tsuda","津田 篤宏","つだ あつひろ","hyogo","M","8ff489e6",["Cream Quiz","Born in Hyogo; one half of the comedy duo ダイアン (Diane)"]),
 ("kazuki-enari","Kazuki Enari","えなり かずき","えなり かずき","tokyo","M","8ca70f23",["Cream Quiz","Tokyo-born; recognizable for his long-running child-actor career"]),
 ("teppei-arita","Teppei Arita","有田 哲平","ありた てっぺい","kumamoto","M","9afe4156",["Cream Quiz","Met Ueda through their high-school rugby club"]),
 ("shinya-ueda","Shinya Ueda","上田 晋也","うえだ しんや","kumamoto","M","8a2542c0",["Cream Quiz","Originally used Kumamoto dialect with Arita when developing their comedy routines"]),
 ("shigeo-takahashi","Shigeo Takahashi","高橋 茂雄","たかはし しげお","kyoto","M","49cfcb5b",["Cream Quiz","Kyoto-born; part of the comedy duo サバンナ (Savanna)"]),
 ("yoshiko-miyazaki","Yoshiko Miyazaki","宮崎 美子","みやざき よしこ","kumamoto","F","91083777",["Cream Quiz","Strong Kumamoto association despite the surname Miyazaki, which is also a prefecture name"]),
 ("hideki-takahashi","Hideki Takahashi","高橋 英樹","たかはし ひでき","chiba","M","39a54ed8",["Cream Quiz","Born in Chiba; famous for historical television dramas"]),
 ("tetsuro-degawa","Tetsuro Degawa","出川 哲朗","でがわ てつろう","kanagawa","M","764a5f21",["Cream Quiz","From Yokohama; a connection between Itte Q! and Cream Quiz"]),
]
def photo(h):
    im = Image.open(f"{UP}{h}-image.jpg").convert("RGB"); im.thumbnail((440, 440))
    b = io.BytesIO(); im.save(b, "JPEG", quality=80, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()
items = []
for i, (slug, name, kj, rd, pref, sex, h, facts) in enumerate(P):
    items.append({"id": f"person-{slug}", "templateId": "t-person", "created": 1700000100000 + i, "updated": 1700000100000 + i, "mnemonic": "",
      "values": {"photo": photo(h), "kanji": kj, "reading": rd, "name": name, "prefecture": f"pref-{pref}", "sex": sex},
      "facts": [{"id": f"p{i}-{j}", "text": t, "date": "2026-11-12", "source": "list"} for j, t in enumerate(facts)]})
json.dump({"id": "pack-2026-11b", "items": items}, open(sys.argv[1], "w"), ensure_ascii=False, separators=(",", ":"))
print(len(items), "cards,", len(open(sys.argv[1]).read()) // 1024, "KB")
