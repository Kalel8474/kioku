"""Builds src/pack-2026-11d.json: 47 more celebrity cards (charts 1-5 + replacement chart + Aya Ueto). Usage: python3 -I tools/build_pack_d.py <out.json>"""
import base64, io, json, sys
from PIL import Image
UP = "/mnt/user-data/uploads/"
# slug, name, kanji, reading, prefecture, sex, photo hash, tags, [facts]
P = [
 ("anne-nakamura","Anne Nakamura","中村 アン","なかむら あん","tokyo","F","7ba7dc8b",[],["Actress, model, television personality"]),
 ("yuki-uchida","Yuki Uchida","内田 有紀","うちだ ゆき","tokyo","F","08d2c905",[],["Actress and singer"]),
 ("miki-nakatani","Miki Nakatani","中谷 美紀","なかたに みき","tokyo","F","ed2ea0ce",[],["Film and television actress"]),
 ("masahiro-nakai","Masahiro Nakai","中居 正広","なかい まさひろ","kanagawa","M","fce5a7e4",["SMAP"],["Former SMAP member and television host"]),
 ("eikichi-yazawa","Eikichi Yazawa","矢沢 永吉","やざわ えいきち","hiroshima","M","24f1aec3",[],["Legendary Japanese rock singer"]),
 ("ami-touma","Ami Touma","當真 あみ","とうま あみ","okinawa","F","54cb2804",[],["Young actress"]),
 ("mio-imada","Mio Imada","今田 美桜","いまだ みお","fukuoka","F","09ab0c01",[],["Actress and model"]),
 ("tamori","Tamori","タモリ","たもり","fukuoka","M","23694ccf",[],["Long-running television host; Waratte Iitomo!"]),
 ("akiko-wada","Akiko Wada","和田 アキ子","わだ あきこ","osaka","F","c02edb7a",[],["Singer and veteran variety-show personality"]),
 ("namie-amuro","Namie Amuro","安室 奈美恵","あむろ なみえ","okinawa","F","bc97430e",[],["From Naha. J-pop icon; Okinawa Actors School"]),
 ("naomi-watanabe","Naomi Watanabe","渡辺 直美","わたなべ なおみ","ibaraki","F","743201ce",[],["Raised in Ibaraki; born in Taiwan. Comedian, fashion personality, Beyoncé impersonations"]),
 ("matsuko-deluxe","Matsuko Deluxe","マツコ・デラックス","まつこ・でらっくす","chiba","","ef98cdfd",[],["Television commentator and host"]),
 ("eiko-koike","Eiko Koike","小池 栄子","こいけ えいこ","tokyo","F","48d3eb35",[],["Actress and variety-show guest"]),
 ("satoshi-ohno","Satoshi Ohno","大野 智","おおの さとし","tokyo","M","703a72d5",["Arashi"],["Arashi member"]),
 ("sho-sakurai","Sho Sakurai","櫻井 翔","さくらい しょう","tokyo","M","a4725133",["Arashi"],["Arashi member and news presenter"]),
 ("masaki-aiba","Masaki Aiba","相葉 雅紀","あいば まさき","chiba","M","b26c9fd3",["Arashi"],["Arashi member; variety television"]),
 ("naomi-osaka","Naomi Osaka","大坂 なおみ","おおさか なおみ","osaka","F","61562186",[],["Born in Osaka. Tennis champion; international sports"]),
 ("kiko-mizuhara","Kiko Mizuhara","水原 希子","みずはら きこ","hyogo","F","299229bb",[],["Raised in Kobe; born in the U.S. Model and actress"]),
 ("tsurube-shofukutei","Tsurube Shofukutei","笑福亭 鶴瓶","しょうふくてい つるべ","osaka","M","4547f854",[],["Rakugo performer and television host"]),
 ("naoki-tanaka","Naoki Tanaka","田中 直樹","たなか なおき","osaka","M","7d3245fc",[],["Cocorico comedy duo"]),
 ("ryosuke-yamada","Ryosuke Yamada","山田 涼介","やまだ りょうすけ","tokyo","M","7a8ac3e6",[],["Hey! Say! JUMP singer and actor"]),
 ("hiroyuki-sanada","Hiroyuki Sanada","真田 広之","さなだ ひろゆき","tokyo","M","9f3bf731",[],["International film and television actor"]),
 ("osamu-shitara","Osamu Shitara","設楽 統","したら おさむ","saitama","M","62dfa522",[],["Bananaman comedian and television host"]),
 ("gen-hoshino","Gen Hoshino","星野 源","ほしの げん","saitama","M","8c3c26c3",[],["Singer, actor; Nigeru wa Haji da ga Yaku ni Tatsu"]),
 ("kazuya-kamenashi","Kazuya Kamenashi","亀梨 和也","かめなし かずや","tokyo","M","24ba5588",[],["Singer and actor; KAT-TUN"]),
 ("tadanobu-asano","Tadanobu Asano","浅野 忠信","あさの ただのぶ","kanagawa","M","d55975b8",[],["Internationally known film actor"]),
 ("nanao","Nanao","菜々緒","ななお","saitama","F","c72cae03",[],["Model and actress; full name 荒井 菜々緒"]),
 ("yoshino-kimura","Yoshino Kimura","木村 佳乃","きむら よしの","tokyo","F","3a2f3267",[],["Raised in Tokyo; born in London. Actress and variety television"]),
 ("tomoya-nagase","Tomoya Nagase","長瀬 智也","ながせ ともや","kanagawa","M","34917bcc",[],["Former TOKIO member and actor"]),
 ("koji-yakusho","Koji Yakusho","役所 広司","やくしょ こうじ","nagasaki","M","b425d089",[],["From Isahaya. Actor; Perfect Days"]),
 ("masatoshi-hamada","Masatoshi Hamada","浜田 雅功","はまだ まさとし","osaka","M","ce046db6",["Downtown"],["Born in Osaka; raised in Hyogo. Downtown comedian"]),
 ("hitoshi-matsumoto","Hitoshi Matsumoto","松本 人志","まつもと ひとし","hyogo","M","627e3f48",["Downtown"],["From Amagasaki. Downtown comedian"]),
 ("yuu-aoi","Yuu Aoi","蒼井 優","あおい ゆう","fukuoka","F","a7f510db",[],["Film and television actress"]),
 ("mana-ashida","Mana Ashida","芦田 愛菜","あしだ まな","hyogo","F","36ac9af0",[],["Actress and television personality"]),
 ("hiyori-sakurada","Hiyori Sakurada","桜田 ひより","さくらだ ひより","chiba","F","40616ed3",[],["Young film and television actress"]),
 ("masatoshi-nakamura","Masatoshi Nakamura","中村 雅俊","なかむら まさとし","miyagi","M","aa03e13c",[],["Actor and singer; Ore-tachi no Tabi"]),
 ("patrick-harlan","Patrick Harlan","パトリック・ハーラン","ぱとりっく・はーらん","fukui","M","250f51e8",[],["From Colorado, USA. Pakkun; comedy duo Pakkun Makkun","Former Fukui resident, English teacher, regional ambassador"]),
 ("dave-spector","Dave Spector","デーブ・スペクター","でーぶ・すぺくたー","tokyo","M","d3e8ab69",[],["From Illinois, USA. American-born Japanese television commentator","University studies and television career in Tokyo; Osaka Expo as a secondary hook"]),
 ("ikko","IKKO","IKKO","いっこ","fukuoka","","1438e695",[],["Beauty expert; signature expression 「どんだけ〜！」"]),
 ("ayami-nakajo","Ayami Nakajo","中条 あやみ","なかじょう あやみ","osaka","F","75d0970c",[],["Actress and model"]),
 ("takako-matsu","Takako Matsu","松 たか子","まつ たかこ","tokyo","F","14c2e262",[],["Actress and singer; Japanese voice of Elsa in Frozen"]),
 ("nozomi-sasaki","Nozomi Sasaki","佐々木 希","ささき のぞみ","akita","F","a5e2cc16",[],["Actress and model; strong Akita hometown association"]),
 ("koji-kato","Koji Kato","加藤 浩次","かとう こうじ","hokkaido","M","830223d2",[],["Comedian and television host; raised in Otaru"]),
 ("hidetoshi-nishijima","Hidetoshi Nishijima","西島 秀俊","にしじま ひでとし","tokyo","M","c0a79372",[],["Actor; Drive My Car"]),
 ("junpei-mizobata","Junpei Mizobata","溝端 淳平","みぞばた じゅんぺい","wakayama","M","01dc3458",[],["Actor; born in Hashimoto City"]),
 ("nana-komatsu","Nana Komatsu","小松 菜奈","こまつ なな","yamanashi","F","5d82422e",[],["Raised in Yamanashi; born in Tokyo. Actress and model; The World of Kanako"]),
 ("aya-ueto","Aya Ueto","上戸 彩","うえと あや","tokyo","F","9c33e0a1",[],["Born in Nerima, Tokyo. Actress and singer; Hanzawa Naoki, Hirugao"]),
]
def photo(h):
    im = Image.open(f"{UP}{h}-image.jpg").convert("RGB"); im.thumbnail((440, 440))
    b = io.BytesIO(); im.save(b, "JPEG", quality=80, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()
items = []
for i, (slug, name, kj, rd, pref, sex, h, tags, facts) in enumerate(P):
    vals = {"photo": photo(h), "kanji": kj, "reading": rd, "name": name, "prefecture": f"pref-{pref}"}
    if sex: vals["sex"] = sex
    it = {"id": f"person-{slug}", "templateId": "t-person", "created": 1700000300000 + i, "updated": 1700000300000 + i, "mnemonic": "", "values": vals,
      "facts": [{"id": f"d{i}-{j}", "text": t, "date": "2026-11-13", "source": "list"} for j, t in enumerate(facts)]}
    if tags: it["tags"] = tags
    items.append(it)
assert len({i["id"] for i in items}) == len(items) == 47
json.dump({"id": "pack-2026-11d", "items": items}, open(sys.argv[1], "w"), ensure_ascii=False, separators=(",", ":"))
print(len(items), "cards,", len(open(sys.argv[1]).read()) // 1024, "KB")
