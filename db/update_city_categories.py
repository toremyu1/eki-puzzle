import requests
from bs4 import BeautifulSoup
import json
import urllib.parse  # ← この行を追加（URLを合成・変換するための機能）
import re            # ← この行も追加（文字を検索・置換するための機能）

def fetch_wikipedia_cities():
    headers = {"User-Agent": "CityCategoryFetcher/1.0"}

    # ＝＝＝ 0. 既存データの読み込み（安全装置） ＝＝＝
    try:
        with open("city_categories.json", "r", encoding="utf-8") as f:
            result_dict = json.load(f)
        print("既存の 'city_categories.json' を読み込みました。エラー時はこのデータを保持します。\n")
        # 必要なキーが存在しない場合の保険
        for key in ["政令指定都市", "中核市", "施行時特例市", "都道府県庁所在地"]:
            if key not in result_dict:
                result_dict[key] = []
    except (FileNotFoundError, json.JSONDecodeError):
        print("既存のデータが見つからない、または破損しているため、新規作成として開始します。\n") 

    result_dict = {
        "政令指定都市": [],
        "中核市": [],
        "施行時特例市": [],
        "都道府県庁所在地": []
    }

    # 各カテゴリーの取得先URLと、目的の表の「見出しID」を厳密に指定します
    configs = [
        {
            "category": "政令指定都市",
            "url": "https://ja.wikipedia.org/wiki/政令指定都市",
            "target_id": "政令指定都市一覧" # Wikipediaの該当見出しID
        },
        {
            "category": "中核市",
            "url": "https://ja.wikipedia.org/wiki/中核市",
            "target_id": "一覧"         # ご提示いただいたHTMLの該当見出しID
        },
        {
            "category": "施行時特例市",
            "url": "https://ja.wikipedia.org/wiki/特例市",
            "target_id": "特例市の一覧"
        }
    ]

    print("Wikipediaから最新のリストを取得しています...\n")

    for config in configs:
        cat = config["category"]
        temp_list = [] # 一時退避用のリスト
        try:
            res = requests.get(config["url"], headers=headers, timeout=10)
            res.raise_for_status() # HTTPエラー（404や500など）が発生した場合は直ちに例外を投げる
            soup = BeautifulSoup(res.text, "html.parser")

            # 1. 目的の見出し（id）をピンポイントで探す
            header = soup.find(id=config["target_id"])

            # idで見つからない場合の保険（テキスト完全一致で探す）
            if not header:
                for h in soup.find_all(['h2', 'h3']):
                    if h.get_text(strip=True) == config["target_id"]:
                        header = h
                        break

            # 危険なフォールバックを廃止し、見出しが見つかった場合のみ直後の表を取得する
            if header:
                target_table = header.find_next("table", class_="wikitable")

                if target_table:
                    # 1行目（ヘッダー）を除外してループ
                    for row in target_table.find_all("tr")[1:]:
                        cells = row.find_all(["th", "td"])
                        city_found = False

                        # 備考欄の誤抽出を防ぐため、左から3セルまでを探索
                        for cell in cells[:3]:
                            for a_tag in cell.find_all("a"):
                                name = a_tag.get_text(strip=True)

                                if name.endswith("市"):
                                  # 重複チェック用のリストを作成
                                    # 比較対象を result_dict から temp_list に変更
                                    existing_names = [item["name"] for item in temp_list]

                                    if 2 <= len(name) <= 8 and name not in ["特例市", "中核市", "政令指定都市", "指定都市"] and name not in existing_names:
                                        # URLの取得と絶対URLへの変換
                                        href = a_tag.get("href")
                                        city_url = urllib.parse.urljoin(config["url"], href) if href else ""
                                        city_url = urllib.parse.unquote(city_url)  # 日本語にデコード

                                        # 辞書形式で追加
                                        temp_list.append({"name": name, "url": city_url})

                                    city_found = True
                                    break # 同じセルの残りのリンクは無視

                            if city_found:
                                break # 見つかったら行の探索を終了

            # エラーなく完了し、データが取得できていれば上書き更新（コミット）
            if len(temp_list) > 0:
                result_dict[cat] = temp_list
                print(f"[{cat}] {len(temp_list)}件 取得・更新完了")
            else:
                print(f"[{cat}] 取得件数が0件でした。既存のデータを保持します。")

        except Exception as e:
            print(f"[{cat}] 取得エラー: {e} -> 既存のデータを保持します。")


    # ＝＝＝ 3. 都道府県庁所在地の抽出（自己修復型ハイブリッド方式） ＝＝＝
    cat = "都道府県庁所在地"
    temp_list_pref = [] # 一時退避用のリスト
    print(f"\n[{cat}] のデータを取得しています...")
    try:
        base_url = "https://ja.wikipedia.org/wiki/都道府県"
        res = requests.get(base_url, headers=headers, timeout=10)
        res.raise_for_status()
        soup = BeautifulSoup(res.text, "html.parser")

        # ヘッダーに「都道府県庁所在地」を含むwikitableを探す
        target_table = None
        for table in soup.find_all("table", class_="wikitable"):
            if "都道府県庁所在地" in table.get_text():
                target_table = table
                break

        if target_table:
            # 1行目（ヘッダー）を除外してループ
            for row in target_table.find_all("tr")[1:]:
                cells = row.find_all(["th", "td"])

                # 必要な列数があるか確認
                if len(cells) >= 5:
                    # 都道府県名の取得
                    a_pref = cells[1].find("a")
                    pref_name = a_pref.get_text(strip=True) if a_pref else cells[1].get_text(strip=True)

                    # 所在地名とURLの取得
                    a_city = cells[3].find("a")
                    city_name = a_city.get_text(strip=True) if a_city else cells[3].get_text(strip=True)

                    # 【修正1】通常ルート用のURL取得と日本語デコード処理を追加
                    city_href = a_city.get("href") if a_city else ""
                    city_url = urllib.parse.urljoin(base_url, city_href) if city_href else ""
                    city_url = urllib.parse.unquote(city_url)

                    # 既に登録されている都市名のリストを作成（重複チェック用）
                    existing_names = [item["name"] for item in temp_list_pref]

                    # 所在地が「市」で終わっていればそのまま抽出（通常ルート）
                    if city_name.endswith("市"):
                        if city_name not in existing_names:
                            temp_list_pref.append({"name": city_name, "url": city_url})

                    # 「市」で終わらない場合（東京都区部など）は、個別ページへ逃げる（特殊ルート）
                    else:
                        print(f"  -> '{pref_name}' の所在地が '{city_name}' のため、個別ページ({pref_name})のInfoboxを調査します...")
                        try:
                            # ページへのアクセス用URLはエンコード（quote）が必要
                            p_url = f"https://ja.wikipedia.org/wiki/{urllib.parse.quote(pref_name)}"
                            p_res = requests.get(p_url, headers=headers, timeout=10)
                            p_res.raise_for_status()
                            p_soup = BeautifulSoup(p_res.text, "html.parser")

                            # 基礎情報（Infobox）を取得
                            infobox = p_soup.find("table", class_="infobox")
                            if infobox:
                                for tr in infobox.find_all("tr"):
                                    th = tr.find("th")
                                    # 所在地が書かれている行を探す
                                    if th and "所在地" in th.get_text(strip=True):
                                        td = tr.find("td")
                                        if td:
                                            # <br>タグをスペースに置換
                                            for br in td.find_all("br"):
                                                br.replace_with(" ")
                                            address = td.get_text(strip=True)

                                            # 郵便番号を確実に除去
                                            address = re.sub(r"〒?\d{3}-\d{4}\s*", "", address)
                                            # 都道府県名を取り除く
                                            address_no_pref = address.replace(pref_name, "")

                                            # 正規表現：郡があればスキップし、最初の市区町村を抽出
                                            pattern = r"(?:[^郡\s]+郡)?([^市区町村\s]+[市区町村])"
                                            match = re.search(pattern, address_no_pref)

                                            if match:
                                                extracted_city = match.group(1)
                                                if extracted_city not in existing_names:
                                                    # 【修正2】JSONに保存するURLはquote()を外して日本語のまま結合
                                                    extracted_url = f"https://ja.wikipedia.org/wiki/{extracted_city}"
                                                    temp_list_pref.append({"name": extracted_city, "url": extracted_url})
                                                    print(f"    -> Infoboxから '{extracted_city}' を抽出完了")
                                        break # 所在地を見つけたらループ終了
                        except Exception as e:
                            print(f"    -> 個別ページの調査中にエラーが発生しました: {e}")

        # エラーなく完了し、データが取得できていれば上書き更新
        if len(temp_list_pref) > 0:
            result_dict[cat] = temp_list_pref
            print(f"[{cat}] {len(temp_list_pref)}件 取得・更新完了")
        else:
            print(f"[{cat}] 取得件数が0件でした。既存のデータを保持します。")
            
    except Exception as e:
        print(f"[{cat}] 大元ページ取得エラー: {e} -> 既存のデータを保持します。")

    # JSONファイルへ保存
    with open("city_categories.json", "w", encoding="utf-8") as f:
        json.dump(result_dict, f, ensure_ascii=False, indent=2)

    print("\nすべての処理が完了し、'city_categories.json' を保存しました。")

if __name__ == "__main__":
    fetch_wikipedia_cities()
