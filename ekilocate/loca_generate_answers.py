import json
import hashlib
import os
from datetime import datetime, timedelta, timezone

# JS側と完全に一致させるための暗号化キー
SECRET_SALT = "EkiLocate_Secret_2026!"

# JavaScriptの Math.imul と全く同じビット演算を行う関数（運命の計算式）
def math_imul(a, b):
    return ((a & 0xffffffff) * (b & 0xffffffff)) & 0xffffffff

def zero_fill_right_shift(val, n):
    return (val % 0x100000000) >> n

# 座標（またはURL）から同一駅判定用のキーを作る関数
def get_coord_key(s):
    lat = s.get('latitude')
    lon = s.get('longitude')
    if lat is not None and lon is not None:
        return f"{lat},{lon}"
    return s.get('url', 'unknown')

def generate_answers():
    try:
        with open('../stations.json', 'r', encoding='utf-8') as f:
            raw_stations = json.load(f)
    except Exception as e:
        print(f"駅データの取得に失敗しました: {e}")
        return

    # JSの自力計算と同じく、貨物駅を除外し必須項目を満たす駅だけを抽出
    valid_stations = []
    for s in raw_stations:
        companies = s.get('companies', [])
        if not s.get('pref') or not s.get('address') or s.get('min_km') is None or not companies:
            continue
        if len(companies) == 1 and companies[0] == "日本貨物鉄道":
            continue
        valid_stations.append(s)

    # 基準日（Day 0）と今日の日付インデックスの計算
    base_date = datetime(2024, 1, 1, tzinfo=timezone.utc)
    now_jst = datetime.now(timezone(timedelta(hours=9)))
    today_index = (now_jst.date() - base_date.date()).days

    os.makedirs('answers', exist_ok=True)
    os.makedirs('answers_admin', exist_ok=True)

    generated_hashes = {}
    generated_admin = {}

    lookback = 1000
    next_available_day = {}

    # ==============================================================
    # JSの自力計算（フォールバック）と1ミリも違わない歴史シミュレーション
    # ==============================================================
    for d in range(0, today_index + 43):
        pool_normal = []
        pool_hard = []
        
        # 1. その日(d)の時点で現役であり、かつクールダウンが終わっている駅を箱に入れる
        for s in valid_stations:
            s_start = s.get('startDay')
            s_end = s.get('endDay')
            c_key = get_coord_key(s)
            
            if s_start is not None and s_start > d:
                continue
            if s_end is not None and s_end <= d and s_end != 999999:
                continue
            if next_available_day.get(c_key, 0) > d:
                continue
            
            pool_normal.append(s)
            pool_hard.append(s)
            
        # 安全装置（万が一箱が空になったら全駅を復活させる）
        if not pool_normal:
            pool_normal = list(valid_stations)
            pool_hard = list(valid_stations)

        # --------------------------------------------------
        # ① 通常モードの抽選
        # --------------------------------------------------
        seed_n = d * 33333 + 54321
        hash_n = math_imul(seed_n ^ zero_fill_right_shift(seed_n, 15), 2246822507)
        hash_n = math_imul(hash_n ^ zero_fill_right_shift(hash_n, 13), 3266489909)
        hash_n = zero_fill_right_shift(hash_n ^ zero_fill_right_shift(hash_n, 16), 0)

        candidate_normal = pool_normal[hash_n % len(pool_normal)]
        
        # 選ばれたらスケジュール帳を更新（1000日間出勤禁止）
        next_available_day[get_coord_key(candidate_normal)] = d + lookback + 1

        # --------------------------------------------------
        # ② ハードモードの抽選
        # --------------------------------------------------
        # JSと完全一致：たった今通常モードで選ばれた駅をハードの箱から抜く（同日被り防止）
        normal_key = get_coord_key(candidate_normal)
        pool_hard = [s for s in pool_hard if get_coord_key(s) != normal_key]
        
        if not pool_hard:
            pool_hard = list(valid_stations)

        seed_h = d * 33333 + 99999
        hash_h = math_imul(seed_h ^ zero_fill_right_shift(seed_h, 15), 2246822507)
        hash_h = math_imul(hash_h ^ zero_fill_right_shift(hash_h, 13), 3266489909)
        hash_h = zero_fill_right_shift(hash_h ^ zero_fill_right_shift(hash_h, 16), 0)

        candidate_hard = pool_hard[hash_h % len(pool_hard)]
        next_available_day[get_coord_key(candidate_hard)] = d + lookback + 1

        # ==============================================================
        # 以降は出力ファイルの生成（今日以降のデータのみをファイルに書き込む）
        # ==============================================================
        if d >= today_index:
            target_date = base_date + timedelta(days=d)
            date_str = target_date.strftime('%Y-%m-%d')
            
            if date_str not in generated_hashes:
                generated_hashes[date_str] = {}
                generated_admin[date_str] = {}
            
            # JSの calcSha256 と完全一致するハッシュ化
            n_hashed = hashlib.sha256((SECRET_SALT + candidate_normal['kanji']).encode('utf-8')).hexdigest()
            h_hashed = hashlib.sha256((SECRET_SALT + candidate_hard['kanji']).encode('utf-8')).hexdigest()
            
            generated_hashes[date_str]['normal'] = n_hashed
            generated_hashes[date_str]['hard'] = h_hashed
            
            # 管理者用の平文確認データ
            generated_admin[date_str]['normal'] = {
                "kanji": candidate_normal['kanji'], "yomi": candidate_normal['yomi'],
                "pref": candidate_normal['pref'], "municipality": candidate_normal['municipality']
            }
            generated_admin[date_str]['hard'] = {
                "kanji": candidate_hard['kanji'], "yomi": candidate_hard['yomi'],
                "pref": candidate_hard['pref'], "municipality": candidate_hard['municipality']
            }

# ==============================================================
    # 4. JSONファイルへの書き込み（直近3日間は上書きしない安全仕様）
    # ==============================================================
    # ファイルを何度も開閉せず、キャッシュを利用して一括処理します
    cache_hashes = {}
    cache_admin = {}

    # generated_hashes には「今日から42日後」までのデータが揃っているため、
    # rangeを使わずにこの辞書の中身をそのままイテレート（反復）します。
    for date_str, modes_data in generated_hashes.items():
        target_date = datetime.strptime(date_str, '%Y-%m-%d').replace(tzinfo=timezone.utc)
        d_current = (target_date.date() - base_date.date()).days
        year_str = str(target_date.year)
        
        filepath_hash = f'answers/{year_str}.json'
        filepath_admin = f'answers_admin/{year_str}_admin.json'

        # キャッシュになければ、ファイルから読み込む（または新規作成）
        if filepath_hash not in cache_hashes:
            if os.path.exists(filepath_hash):
                with open(filepath_hash, 'r', encoding='utf-8') as f:
                    cache_hashes[filepath_hash] = json.load(f)
            else:
                cache_hashes[filepath_hash] = {}
                
        if filepath_admin not in cache_admin:
            if os.path.exists(filepath_admin):
                with open(filepath_admin, 'r', encoding='utf-8') as f:
                    cache_admin[filepath_admin] = json.load(f)
            else:
                cache_admin[filepath_admin] = {}

        # 保護対象期間の判定（今日から3日後までは上書きしない）
        is_protected = (d_current <= today_index + 3)

        # 本番用ファイルの更新
        # 「保護期間中」かつ「すでにデータが存在する」場合を除き、書き込む
        if not (is_protected and date_str in cache_hashes[filepath_hash]):
            cache_hashes[filepath_hash][date_str] = generated_hashes[date_str]
            
        # 管理者用ファイルの更新
        if not (is_protected and date_str in cache_admin[filepath_admin]):
            cache_admin[filepath_admin][date_str] = generated_admin[date_str]

    # すべてのデータの処理が終わった後、各ファイルを1回だけ上書き保存する
    for filepath, data in cache_hashes.items():
        with open(filepath, 'w', encoding='utf-8') as f:
            sorted_data = dict(sorted(data.items())) # 日付順に綺麗にソート
            json.dump(sorted_data, f, ensure_ascii=False, separators=(',', ':'))

    for filepath, data in cache_admin.items():
        with open(filepath, 'w', encoding='utf-8') as f:
            sorted_data = dict(sorted(data.items())) # 日付順に綺麗にソート
            json.dump(sorted_data, f, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    generate_answers()
