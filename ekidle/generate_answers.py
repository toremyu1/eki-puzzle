import json
import hashlib
import os
from datetime import datetime, timedelta, timezone

SECRET_SALT = "EkiDoru_Secret_2026!"
STATE_FILE = "state.json"

quad4, quad5, quad6 = [], [], []


def math_imul(a, b):
    return ((a & 0xffffffff) * (b & 0xffffffff)) & 0xffffffff

def zero_fill_right_shift(val, n):
    return (val & 0xffffffff) >> n

# カタカナをひらがなに変換する関数
def to_hiragana(text):
    return "".join([chr(ord(c) - 0x60) if 0x30A1 <= ord(c) <= 0x30F6 else c for c in text])

def generate_answers():
    try:
        with open('../stations.json', 'r', encoding='utf-8') as f:
            raw_stations = json.load(f)
    except Exception as e:
        print(f"駅データの取得に失敗しました: {e}")
        return

    # JS側と完全に同じ「完全な駅」だけを抽出するフィルター
    stations = []
    for s in raw_stations:
        if s.get('is_abolished_confirmed') is True: continue
        if not s.get('pref'): continue
        if not s.get('address'): continue
        if s.get('min_km') is None: continue
        companies = s.get('companies', [])
        if not companies: continue
        if len(companies) == 1 and companies[0] == "日本貨物鉄道": continue
        
        s['yomi'] = to_hiragana(s['yomi'])
        stations.append(s)

    base_date = datetime(2024, 1, 1, tzinfo=timezone.utc)
    now_jst = datetime.now(timezone(timedelta(hours=9)))
    today_index = (now_jst.date() - base_date.date()).days

    os.makedirs('answers', exist_ok=True)
    os.makedirs('answers_admin', exist_ok=True)

    app_state = {}
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r', encoding='utf-8') as f:
                app_state = json.load(f)
                print("state.json を読み込みました。差分のみ計算します。")
        except Exception as e:
            print(f"state.jsonの読み込み失敗。0日目から計算します: {e}")

    target_day = today_index + 43
    banned_days = app_state.get("banned_days", {})
    last_calculated_day = app_state.get("last_calculated_day", -1)

    if last_calculated_day >= target_day:
        print("必要な日数の計算は既に完了しています。")
        return

    unique_yomi_count = len(set([s['yomi'] for s in stations]))
    lookback = min(1000, int(unique_yomi_count * 0.7))
    start_day = last_calculated_day + 1

    generated_hashes = {}
    generated_admin = {}


    for d in range(start_day, target_day + 1):
        # その日の「現役」駅リスト（出禁考慮なしの復活プール）
        valid_pool = [s for s in stations if 
                      (s.get('startDay') is None or s['startDay'] <= d) and 
                      (s.get('endDay') is None or s['endDay'] > d or s['endDay'] == 999999)]
        
        # 通常のガチャ用プール（出禁駅を除外）
        pool = [s for s in valid_pool if banned_days.get(s['yomi'], 0) <= d]

        # シード値にもソルトを混ぜ込む処理
        def generate_salted_seed(day, salt):
            text = str(day) + salt
            hash_val = 0
            for char in text:
                hash_val = ((hash_val << 5) - hash_val) + ord(char)
                hash_val &= 0xFFFFFFFF # 32bit整数化
                if hash_val & 0x80000000:
                    hash_val -= 0x100000000 # JSと同じ符号付き整数に変換
            return abs(hash_val)

        # ソルトを混ぜた強固なシードに変更します
        seed = generate_salted_seed(d, SECRET_SALT)

        def draw_gacha(char_len):
            nonlocal seed, pool, valid_pool
            candidates = [s for s in pool if len(s['yomi']) == char_len]
            
            # 枯渇時の安全装置：出禁ルールを無視して現役駅全体から復活させる
            if not candidates:
                candidates = [s for s in valid_pool if len(s['yomi']) == char_len]
            
            seed = math_imul(seed ^ zero_fill_right_shift(seed, 15), 2246822507)
            seed = math_imul(seed ^ zero_fill_right_shift(seed, 13), 3266489909)
            hash_val = zero_fill_right_shift(seed ^ zero_fill_right_shift(seed, 16), 0) / 4294967296.0
            
            selected = candidates[int(hash_val * len(candidates))]
            
            # 共通出禁リストに追加し、今日の箱から消す
            banned_days[selected['yomi']] = d + lookback + 1
            pool = [s for s in pool if s['yomi'] != selected['yomi']]
            
            return selected

        # 【重要】JS側と完全に一致させるための固定の順番
        gachi4 = draw_gacha(4)
        gachi5 = draw_gacha(5)
        gachi6 = draw_gacha(6)
        yuru5  = draw_gacha(5)
        # 基準日(2024-01-01)は月曜日。d % 7 == 0 の時だけクアッドを引く
        if d % 7 == 0:
            quad4  = [draw_gacha(4) for _ in range(4)]
            quad5  = [draw_gacha(5) for _ in range(4)]
            quad6  = [draw_gacha(6) for _ in range(4)]
        # 火曜〜日曜はガチャを引かず、直近の月曜日の結果をそのまま保持（または空）にする

        if d >= today_index:
            target_date = base_date + timedelta(days=d)
            date_str = target_date.strftime('%Y-%m-%d')
            
            def get_hash(text):
                return hashlib.sha256((SECRET_SALT + text).encode('utf-8')).hexdigest()
            
            generated_hashes[date_str] = {
                "4": get_hash(gachi4['yomi']),
                "5": get_hash(gachi5['yomi']),
                "6": get_hash(gachi6['yomi']),
                "yurutetsu": get_hash(yuru5['yomi']),
                "quad4": [get_hash(q['yomi']) for q in quad4] if quad4 else [],
                "quad5": [get_hash(q['yomi']) for q in quad5] if quad5 else [],
                "quad6": [get_hash(q['yomi']) for q in quad6] if quad6 else []
            }
            
            generated_admin[date_str] = {
                "4": {"kanji": gachi4['kanji'], "yomi": gachi4['yomi']},
                "5": {"kanji": gachi5['kanji'], "yomi": gachi5['yomi']},
                "6": {"kanji": gachi6['kanji'], "yomi": gachi6['yomi']},
                "yurutetsu": {"kanji": yuru5['kanji'], "yomi": yuru5['yomi']},
                "quad4": [{"kanji": q['kanji'], "yomi": q['yomi']} for q in quad4],
                "quad5": [{"kanji": q['kanji'], "yomi": q['yomi']} for q in quad5],
                "quad6": [{"kanji": q['kanji'], "yomi": q['yomi']} for q in quad6]
            }

    # 出禁リストのクリーンアップ（今日以前に解けた出禁を掃除）
    cleaned_banned_days = {k: v for k, v in banned_days.items() if v > today_index}
    app_state["last_calculated_day"] = target_day
    app_state["banned_days"] = cleaned_banned_days

    # JSONへの書き込みと保護処理
    cache_hashes = {}
    cache_admin = {}
    
    for date_str, modes_data in generated_hashes.items():
        date_obj = datetime.strptime(date_str, '%Y-%m-%d').replace(tzinfo=timezone.utc)
        d_current = (date_obj.date() - base_date.date()).days
        year_str = str(date_obj.year)
        
        filepath_hash = f'answers/{year_str}.json'
        filepath_admin = f'answers_admin/{year_str}_admin.json'

        if filepath_hash not in cache_hashes:
            cache_hashes[filepath_hash] = json.load(open(filepath_hash, 'r', encoding='utf-8')) if os.path.exists(filepath_hash) else {}
        if filepath_admin not in cache_admin:
            cache_admin[filepath_admin] = json.load(open(filepath_admin, 'r', encoding='utf-8')) if os.path.exists(filepath_admin) else {}

        if date_str not in cache_hashes[filepath_hash]:
            cache_hashes[filepath_hash][date_str] = {}
        if date_str not in cache_admin[filepath_admin]:
            cache_admin[filepath_admin][date_str] = {}
            
        # 3日後までは上書き保護する
        is_protected = (d_current <= today_index + 3)

        for mode_key, hashed_text in modes_data.items():
            if is_protected and mode_key in cache_hashes[filepath_hash][date_str]:
                continue
            cache_hashes[filepath_hash][date_str][mode_key] = hashed_text
            cache_admin[filepath_admin][date_str][mode_key] = generated_admin[date_str][mode_key]

    for filepath, data in cache_hashes.items():
        with open(filepath, 'w', encoding='utf-8') as f:
            sorted_data = dict(sorted(data.items()))
            json.dump(sorted_data, f, ensure_ascii=False, separators=(',', ':'))

    for filepath, data in cache_admin.items():
        with open(filepath, 'w', encoding='utf-8') as f:
            sorted_data = dict(sorted(data.items()))
            json.dump(sorted_data, f, ensure_ascii=False, indent=4)

    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(app_state, f, ensure_ascii=False)
    
    print("処理が完了し、状態を保存しました。")

if __name__ == "__main__":
    generate_answers()
