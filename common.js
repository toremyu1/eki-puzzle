// ==========================================
// 共通ユーティリティ（common.js）
// ※駅ドル・駅ロケの両方で共通して使う「道具」の集まりです
// ==========================================

/**
 * 端末の時計や場所に依存せず、確実に「日本時間（JST）」のYYYY-MM-DD文字列を返します
 */
function getJSTDateString() {
  const t = new Date();
  const jstMs = t.getTime() + (t.getTimezoneOffset() * 60000) + (9 * 3600000);
  const jstObj = new Date(jstMs);
  return jstObj.getFullYear() + "-" + String(jstObj.getMonth() + 1).padStart(2, '0') + "-" + String(jstObj.getDate()).padStart(2, '0');
}

/**
 * 基準日（UTC）から数えて、今日（JST）が何日目かを計算します
 * 引数には基準となる年、月（0〜11）、日を渡します
 */
function calculateDayIndex(baseYear, baseMonth, baseDay) {
  const t = new Date();
  const jstMs = t.getTime() + (t.getTimezoneOffset() * 60000) + (9 * 3600000);
  const jstObj = new Date(jstMs);
  const todayUTC = Date.UTC(jstObj.getFullYear(), jstObj.getMonth(), jstObj.getDate());
  const baseUTC = Date.UTC(baseYear, baseMonth, baseDay);
  return Math.round((todayUTC - baseUTC) / 86400000);
}

/**
 * カタカナのフリガナをすべてひらがなに変換します
 */
function toHiragana(str) { 
  return str.replace(/[ァ-ン]/g, m => String.fromCharCode(m.charCodeAt(0) - 0x60)); 
}

/**
 * 文字列を元に、SHA-256形式のハッシュ（暗号文字列）を生成します（非同期）
 */
async function calcSha256(str) {
  const buf = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * セーブデータの改ざんを防止するためのチェックサム（合言葉）を生成します
 * ※駅ドルの generateChecksum と駅ロケの generateLocaChecksum を統合しました
 */
function generateChecksum(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32ビットの整数に変換
  }
  return hash.toString(36);
}


// ==========================================
// 共通UI・システム処理（追加分）
// ==========================================

// どちらのプログレスバー（円形・直線）がHTMLにあっても対応できるように修正します
function updateSharedLoading(percent, text, barId = "circular-progress-bar", textId = "loading-text", pctId = "loading-percentage") {
  const bar = document.getElementById(barId);
  const textEl = document.getElementById(textId);
  const pctEl = document.getElementById(pctId);

  // テキストとパーセンテージの更新
  if (textEl && text) textEl.textContent = text;
  if (pctEl) pctEl.textContent = `${Math.floor(percent)}%`;
  
  // 円形プログレスバーがある場合の処理
  if (bar) bar.style.background = `conic-gradient(#3498db ${percent}%, #e2e8f0 ${percent}%)`;

  // 直線のプログレスバー（電車アイコン付き）がある場合の処理を追加
  const linearBar = document.getElementById('progress-bar');
  const trainIcon = document.getElementById('train-icon');
  if (linearBar && trainIcon) {
    linearBar.style.width = percent + '%';    // バーを伸ばす
    trainIcon.style.left = percent + '%';     // 電車アイコンを進める
  }
}

// 2. 駅データの基本フィルタリングを共通化
// どのゲームでも「絶対に弾くべきエラーデータや貨物駅」をここで一掃します
function getCleanStations(rawStations) {
  return rawStations.filter(s => {
    // 緯度経度などの必須データがない、または完全に廃止された駅を除外
    if (s.is_abolished_confirmed === true) return false;
    if (!s.pref || s.pref === "") return false;
    if (!s.address || s.address === "") return false;
    if (s.min_km == null) return false;
    // 貨物専用駅を除外
    if (s.companies && s.companies.length === 1 && s.companies[0] === "日本貨物鉄道") return false;
    
    return true;
  });
}

// 3. サイドメニューの開閉イベントの共通化
// 指定したIDのボタンとメニュー要素を自動で紐付けます
function setupSharedSideMenu(menuBtnId, menuId, overlayId, closeBtnId) {
  const menuBtn = document.getElementById(menuBtnId);
  const sideMenu = document.getElementById(menuId);
  const overlay = document.getElementById(overlayId);
  const closeBtn = document.getElementById(closeBtnId);

  const closeMenu = () => {
    if (sideMenu && overlay) {
      sideMenu.style.right = "-250px";
      setTimeout(() => overlay.classList.add("hidden"), 300);
    }
  };

  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      if (sideMenu && overlay) {
        overlay.classList.remove("hidden");
        setTimeout(() => sideMenu.style.right = "0", 10);
      }
    });
  }
  if (closeBtn) closeBtn.addEventListener("click", closeMenu);
  if (overlay) overlay.addEventListener("click", closeMenu);
}

// 4. モーダル（説明画面や結果画面）の開閉を共通化
// ヘッダーにある btn-icon（？ボタンなど）にこの関数を適用します
function setupSharedModal(openBtnId, modalId, closeBtnId) {
  const openBtn = document.getElementById(openBtnId);
  const modal = document.getElementById(modalId);
  const closeBtn = document.getElementById(closeBtnId);

  if (openBtn && modal) {
    openBtn.addEventListener("click", () => modal.classList.remove("hidden"));
  }
  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => {
      modal.classList.add("hidden");
      modal.style.display = ""; // 念のためのスタイルリセット
    });
  }
}

// 5. SNSシェア機能の共通化
// プラットフォームの指定と、生成済みのテキスト・URLを受け取って送信します
function executeSharedShare(platform, shareText, shareUrl) {
  const encodedText = encodeURIComponent(shareText);
  const encodedUrl = encodeURIComponent(shareUrl);
  
  if (platform === "twitter") {
    window.open(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`, '_blank');
  } else if (platform === "line") {
    window.open(`https://line.me/R/msg/text/?${encodedText}%20${encodedUrl}`, '_blank');
  } else if (platform === "copy") {
    navigator.clipboard.writeText(`${shareText} ${shareUrl}`).then(() => {
      alert("結果をクリップボードにコピーしました！");
    });
  }
}


// ------------------------------------------
// イベントポップアップ順番待ちシステム（共通化）
// ------------------------------------------
let eventPopupQueue = [];
let isPopupRunning = false;

// 優先度（priority）が小さい順に表示されるキューシステム
function registerEventPopup(priority, actionFunc) {
  eventPopupQueue.push({ priority: priority, action: actionFunc });
}

function startEventPopups() {
  if (isPopupRunning) return; // 既に動いていれば何もしない
  isPopupRunning = true;
  eventPopupQueue.sort((a, b) => a.priority - b.priority); // 優先度順に並び替え
  showNextEventPopup();
}

function showNextEventPopup() {
  if (eventPopupQueue.length > 0) {
    const nextPopup = eventPopupQueue.shift();
    nextPopup.action();
  } else {
    isPopupRunning = false; // 列が空になったら待機状態に戻す
  }
}


// ==========================================
// どんなゲームから呼ばれても動くログイン判定関数
// ==========================================
// 引数 metaKey には "ekiLocateMeta" や "ekiZukanMeta" などの文字列が入ります
function updateSharedLoginStreak(metaKey) {
  // 渡されたキー名を使って、そのゲーム専用の箱からデータを取り出します
  let meta = JSON.parse(localStorage.getItem(metaKey) || "{}");
  const todayStr = new Date().toLocaleDateString('sv-SE'); 

  if (!meta.firstLoginDate) meta.firstLoginDate = todayStr;

  if (meta.lastLoginDate !== todayStr) {
    if (meta.lastLoginDate) {
      let yesterday = new Date(); 
      yesterday.setDate(yesterday.getDate() - 1);
      let yStr = yesterday.toLocaleDateString('sv-SE');
      meta.consecutiveLoginDays = (meta.lastLoginDate === yStr) ? (meta.consecutiveLoginDays || 0) + 1 : 1;
    } else {
      meta.consecutiveLoginDays = 1;
    }
    meta.lastLoginDate = todayStr;
    
    // 渡されたキー名を使って保存し直します
    localStorage.setItem(metaKey, JSON.stringify(meta));
  }
  // 更新されたデータを呼び出し元に返します
  return meta;
}


// ==========================================
// 通信・データフェッチの共通処理
// ==========================================

/**
 * サーバーから駅データ（JSON）をプログレスバー付きでダウンロードし、
 * 失敗時は自動的にCache APIからバックアップを復元する超強力な共通関数です。
 * * @param {string} cacheName - 保存・復元に使うキャッシュの名前（例: 'eki-backup-v1'）
 * @param {string} fallbackUrl - エラー時に戻るURL
 * @returns {Array|null} - 取得した駅データの配列、致命的エラー時はnull
 */
async function downloadSharedGameData(cacheName, fallbackUrl) {
  let raw = [];
  try {
    const res = await fetch('/stations.json', { cache: "no-store" });
    if (!res.ok) throw new Error(`通信エラー (ステータス: ${res.status})`);

    const contentLength = res.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
    let loadedBytes = 0;
    
    const reader = res.body.getReader();
    const chunks = [];

    // 進行度を記憶する変数を追加します
    let fallbackPct = 30;

    // 少しずつデータを読み込み、共通のプログレスバー関数を呼び出す
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      chunks.push(value);
      loadedBytes += value.length;

      if (totalBytes) {
        const percent = 30 + (loadedBytes / totalBytes) * 30;
        updateSharedLoading(percent, `駅データをダウンロード中... (${Math.floor(percent)}%)`);
      } else {
        const mb = (loadedBytes / (1024 * 1024)).toFixed(1);
        // 現在のプログレスバーの数値を無理やり取得して進める
        const currentPct = parseInt(document.getElementById("loading-percentage")?.textContent || "30", 10);
        updateSharedLoading(Math.min(55, currentPct + 0.5), `駅データをダウンロード中... (${mb}MB)`); 
      }
    }

    updateSharedLoading(60, "データを展開・保管中...");

    // バイトデータを結合して文字列化
    const allChunks = new Uint8Array(loadedBytes);
    let position = 0;
    for (const chunk of chunks) {
      allChunks.set(chunk, position);
      position += chunk.length;
    }
    const textData = new TextDecoder("utf-8").decode(allChunks);

    if (textData.trim().startsWith("<")) throw new Error("JSONの代わりにHTMLが読み込まれました。");
    raw = JSON.parse(textData);

    // バックアップの保存
    if ('caches' in window) {
      const cache = await caches.open(cacheName);
      const resToCache = new Response(textData, { headers: { 'Content-Type': 'application/json' } });
      cache.put('/stations.json', resToCache).catch(e => console.warn("キャッシュ保存スキップ:", e));
    }
    return raw;

  } catch (err) {
    console.warn("最新データの取得に失敗。バックアップを使用します:", err);
    // バックアップ復元処理
    if ('caches' in window) {
      const cache = await caches.open(cacheName);
      const cachedRes = await cache.match('/stations.json');
      if (cachedRes) {
        if (!document.getElementById("offline-warning-banner")) {
          document.body.insertAdjacentHTML("afterbegin", "<div id='offline-warning-banner' style='background-color: #fff3e0; color: #e65100; font-size: 11px; font-weight: bold; text-align: center; padding: 6px; border-bottom: 1px solid #ffcc80; width: 100%; box-sizing: border-box;'>⚠️ バックアップデータで運行中。最新の駅情報と異なる場合があります。</div>");
        }
        return await cachedRes.json();
      }
    }
    
    // バックアップもない場合の致命的エラー表示
    document.body.innerHTML = `
      <div style="text-align:center; padding:50px; font-family:sans-serif; background-color:#f0f2f5; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center;">
        <h3 style="color:#e53935; font-size:24px; margin-bottom:15px;">駅データの読み込みに失敗しました</h3>
        <p style="font-size:14px; color:#555; margin-bottom:30px;">通信環境が不安定です。<br>電波の良いところで再度お試しください。</p>
        <button onclick="window.location.href='${fallbackUrl}'" style="padding:15px 30px; font-size:18px; font-weight:bold; background:#3498db; color:#fff; border:none; border-radius:8px; cursor:pointer;">
          トップページへ戻る
        </button>
      </div>`;
    return null;
  }
}

/**
 * 今日の答えが格納されたJSONファイルをサーバーから取得する共通関数です。
 * * @param {string} yearStr - 取得したい年（例: "2026"）
 * @returns {Object} - 取得したハッシュデータ
 */
async function fetchSharedAnswerDict(yearStr) {
  const res = await fetch(`answers/${yearStr}.json`, { cache: "no-store" });
  if (!res.ok) throw new Error("答えファイルの取得に失敗しました");
  return await res.json();
}


// ==========================================
// HTMLパーツ生成の共通処理
// ==========================================

/**
 * リザルト画面などで表示する、アフィリエイト広告とWikipediaリンクのHTMLを生成します。
 * 駅の情報を渡すだけで、ゲームの種類問わず同じデザインの広告が出せます。
 */
function generateSharedAffiliateHTML(station, isAprilFool) {
  let safePref = station.pref || "富山県";
  let searchMuni = station.municipality || "富山市";
  let muniMuni = searchMuni;
  
  let isRural = station.population < 0; 
  let areaKeyword = isRural ? safePref : muniMuni;
  let searchKw = isAprilFool ? safePref : areaKeyword;
  
  let prText = isAprilFool 
    ? `＼ 聖地のある「${safePref}」へ巡礼して指の疲れを癒やす ／` 
    : `＼ この駅のある「${isRural ? safePref : safePref + muniMuni}」へ聖地巡礼に行こう！ ／`;

  // 1段目：宿・ホテル予約
  let encodedStation = encodeURIComponent(encodeURIComponent(encodeURIComponent(searchKw)));
  let yahooUrl = `https://px.a8.net/svt/ejp?a8mat=4B5NW1+DE94S2+4ZCO+BW8O2&a8ejpredirect=https%3A%2F%2Ftravel.yahoo.co.jp%2FikCo.ashx%3Fcosid%3Dy_a8net%26surl%3Dhttps%253A%252F%252Ftravel.yahoo.co.jp%252Fsearch%253Fadc%253D1%2526discsort%253D1%2526kwd%253D${encodedStation}%2526lc%253D1%2526ppc%253D2%2526rc%253D1%2526si%253D6`;
  let yahooImp = '<img border="0" width="1" height="1" src="https://www10.a8.net/0.gif?a8mat=4B5NW1+DE94S2+4ZCO+BW8O2" alt="" style="display:none;">';
  
  let rakutenKeyword = encodeURIComponent(encodeURIComponent(searchKw));
  let rakutenUrl = `https://af.moshimo.com/af/c/click?a_id=5616621&p_id=55&pc_id=55&pl_id=624&url=https%3A%2F%2Fkw.travel.rakuten.co.jp%2Fkeyword%2FSearch.do%3Fcharset%3Dutf-8%26f_max%3D30%26l-id%3DtopC_search_keyword%26f_query%3D${rakutenKeyword}`;
  let rakutenImp = '<img src="//i.moshimo.com/af/i/impression?a_id=5616621&p_id=55&pc_id=55&pl_id=624" width="1" height="1" style="border:none;" alt="" loading="lazy">';

  // 2段目：通常のお取り寄せ
  let yahooShoppingDest = `https://shopping.yahoo.co.jp/search/${encodeURIComponent(muniMuni)}+${encodeURIComponent("特産品")}/0/?area=13&first=1&ss_first=1&sretry=0&tab_ex=commerce`;
  let yahooShoppingUrl = `https://af.moshimo.com/af/c/click?a_id=5626583&p_id=1225&pc_id=1925&pl_id=18502&url=${encodeURIComponent(yahooShoppingDest)}`;
  let yahooShoppingImp = '<img src="//i.moshimo.com/af/i/impression?a_id=5626583&p_id=1225&pc_id=1925&pl_id=18502" width="1" height="1" style="border:none;" alt="" loading="lazy">';

  let rakutenMarketDest = `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(muniMuni)}+${encodeURIComponent("特産品")}/`;
  let rakutenMarketUrl = `https://af.moshimo.com/af/c/click?a_id=5616620&p_id=54&pc_id=54&pl_id=616&url=${encodeURIComponent(rakutenMarketDest)}`;
  let rakutenMarketImp = '<img src="//i.moshimo.com/af/i/impression?a_id=5616620&p_id=54&pc_id=54&pl_id=616" width="1" height="1" style="border:none;" alt="" loading="lazy">';

  // 3段目：ふるさと納税
  let yahooFurusatoDest = `https://shopping.yahoo.co.jp/search/${encodeURIComponent(muniMuni)}+${encodeURIComponent("ふるさと納税")}/0/?first=1&ss_first=1&sretry=0&tab_ex=commerce`;
  let yahooFurusatoUrl = `https://af.moshimo.com/af/c/click?a_id=5626583&p_id=1225&pc_id=1925&pl_id=18502&url=${encodeURIComponent(yahooFurusatoDest)}`;
  let yahooFurusatoImp = '<img src="//i.moshimo.com/af/i/impression?a_id=5626583&p_id=1225&pc_id=1925&pl_id=18502" width="1" height="1" style="border:none;" alt="" loading="lazy">';

  let rakutenFurusatoDest = `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(muniMuni)}+${encodeURIComponent("ふるさと納税")}/`;
  let rakutenFurusatoUrl = `https://af.moshimo.com/af/c/click?a_id=5616620&p_id=54&pc_id=54&pl_id=616&url=${encodeURIComponent(rakutenFurusatoDest)}`;
  let rakutenFurusatoImp = '<img src="//i.moshimo.com/af/i/impression?a_id=5616620&p_id=54&pc_id=54&pl_id=616" width="1" height="1" style="border:none;" alt="" loading="lazy">';

  return `
    <div style="margin-bottom:12px;">
    <a href="${station.url}" target="_blank" style="display:inline-block; padding:8px 12px; background-color:#e0e0e0; color:#333; text-decoration:none; border-radius:4px; font-weight:bold; font-size:12px;">Wikipediaで見る</a>
    </div>
    <div style="background-color:#fff3e0; border:1px solid #ffcc80; border-radius:6px; padding:10px; margin-bottom:5px; position:relative;">
    <div style="text-align:center; margin-bottom:8px;">
    <span style="display:inline-block; border:1px solid #aaa; border-radius:4px; padding:1px 6px; font-size:10px; color:#aaa; font-weight:bold;">PR</span>
    </div>
    <div style="font-size:11px; font-weight:bold; color:#e65100; margin-bottom:8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${prText}</div>
    <div style="display:flex; justify-content:center; gap:8px; align-items:center; flex-wrap:wrap;">
    <a href="${yahooUrl}" target="_blank" style="display:flex; justify-content:center; align-items:center; padding:8px 0; background-color:#ffffff; border:1px solid #ff0033; color:#333; text-decoration:none; border-radius:4px; font-weight:bold; font-size:11px; width:45%;">
    <img src="/aff_images/yahoo_japan_icon_64.svg" alt="Y!" style="height:14px; margin-right:4px; border:none;">トラベル
    </a>
    <a href="${rakutenUrl}" target="_blank" style="display:flex; justify-content:center; align-items:center; padding:0; background-color:#00B900; border:1px solid #00B900; border-radius:4px; width:45%; height:32px; overflow:hidden;">
    <img src="/aff_images/R_Travel_v2.04.svg" alt="楽天トラベル" style="height:100%; border:none;">
    </a>
    <div style="width:100%; border-top:1px dashed #ffcc80; margin:6px 0;"></div>
    <div style="width:100%; font-size:11px; font-weight:bold; color:#e65100; margin-bottom:4px; text-align:left; padding-left:5%;">🎁 この土地の名産品をお取り寄せ（通常購入）</div>
    <a href="${yahooShoppingUrl}" target="_blank" style="display:flex; justify-content:center; align-items:center; padding:8px 0; background-color:#ffffff; border:1px solid #ff0033; color:#333; text-decoration:none; border-radius:4px; font-weight:bold; font-size:11px; width:45%;">
    <img src="/aff_images/yahoo_japan_icon_64.svg" alt="Y!" style="height:14px; margin-right:4px; border:none;">ショッピング
    </a>
    <a href="${rakutenMarketUrl}" target="_blank" style="display:flex; justify-content:center; align-items:center; padding:8px 0; background-color:#bf0000; color:#ffffff; border:none; border-radius:4px; font-weight:bold; font-size:11px; width:45%;">
    楽天市場で探す
    </a>
    <div style="width:100%; border-top:1px dashed #ffcc80; margin:6px 0;"></div>
    <div style="width:100%; font-size:11px; font-weight:bold; color:#e65100; margin-bottom:4px; text-align:left; padding-left:5%;">🗾 地域を応援して名産品を貰う（ふるさと納税）</div>
    <a href="${yahooFurusatoUrl}" rel="nofollow" referrerpolicy="no-referrer-when-downgrade" target="_blank" style="display:flex; justify-content:center; align-items:center; padding:8px 0; background-color:#ffffff; border:1px solid #ff0033; color:#333; text-decoration:none; border-radius:4px; font-weight:bold; font-size:11px; width:45%;">
    <img src="/aff_images/yahoo_japan_icon_64.svg" alt="Y!" style="height:14px; margin-right:4px; border:none;">ふるさと納税
    </a>
    <a href="${rakutenFurusatoUrl}" target="_blank" style="display:flex; justify-content:center; align-items:center; padding:8px 0; background-color:#7a0000; color:#ffffff; border:none; border-radius:4px; font-weight:bold; font-size:11px; width:45%;">
    楽天ふるさと納税
    </a>
    </div>
    </div>
    ${rakutenImp}
    ${yahooImp}
    ${rakutenMarketImp}
    ${yahooShoppingImp}
    ${yahooFurusatoImp}
    ${rakutenFurusatoImp}
  `;
}

/**
 * 回答回数の分布を示す棒グラフのHTMLを生成します。
 * * @param {Array} distArray - 分布の配列 [0, 回数1, 回数2...]
 * @param {number} currentTurn - 今回クリアした手数（ハイライト用。クリアしてない場合は-1）
 * @param {number} maxRow - グラフの最大行数（駅ドルなら8、駅ロケなら11など）
 */
function generateSharedStatsGraphHTML(distArray, currentTurn, maxRow) {
  let html = "<div style='font-weight:bold;margin:15px 0 5px;border-bottom:1px solid #ccc;padding-bottom:5px;'>回答回数の分布</div>";
  let maxDist = Math.max(...distArray);
  // エンドレスモードなど手数が多くなるゲームに備え、鮮やかな20色を設定します
  const barColors = [
    "#6aaa64", "#42a5f5", "#26c6da", "#ffca28", "#ffa726", 
    "#ff7043", "#ec407a", "#ab47bc", "#8e24aa", "#5e35b1", 
    "#3949ab", "#1e88e5", "#039be5", "#00acc1", "#00897b", 
    "#43a047", "#7cb342", "#c0ca33", "#fbc02d", "#fb8c00"
  ];
  
  for(let i = 1; i <= maxRow; i++) {
    let count = distArray[i] || 0;
    let w = maxDist > 0 ? Math.max(8, Math.round((count / maxDist) * 100)) : 8;
    let bg = barColors[i-1] || "#6aaa64";
    
    let isTodayRow = (i === currentTurn);
    // 【修正】枠線をグラフバーから外し、数字側に丸いバッジ風のハイライトを適用します
    let numStyle = isTodayRow 
      ? "width:20px; height:20px; line-height:16px; text-align:center; margin-right:5px; font-size:12px; font-weight:900; color:#e65100; background-color:#fff3e0; border:2px solid #ff8c00; border-radius:50%; box-shadow:0 0 4px #ffcc80; box-sizing:border-box;" 
      : "width:20px; font-weight:bold; text-align:right; margin-right:5px; font-size:12px; padding-right:4px; box-sizing:border-box;";
    
    html += `
      <div style="display:flex;align-items:center;margin-bottom:4px;">
        <div style="${numStyle}">${i}</div>
        <div style="flex:1;background-color:#f0f2f5;border-radius:2px;">
          <div style="background-color:${bg};height:18px;width:${w}%;color:white;text-align:right;padding-right:5px;font-size:11px;line-height:18px;border-radius:2px;box-sizing:border-box;">${count}</div>
        </div>
      </div>
    `;
  }
  return html;
}



/**
 * ゲームデータを高度に圧縮（Gzip）または非圧縮で引き継ぎコード化する共通関数
 * @param {string} gameName - ゲームの識別名（例: "Ekidle", "EkiLocate"）
 * @param {Object} dataMap - 各ゲームのLocalStorageから取得したデータのオブジェクト
 */
async function generateSharedTransferCode(gameName, dataMap) {
  // ゲーム名を含めてデータを1つにまとめ、チェックサムを計算します
  const payloadString = JSON.stringify({ game: gameName, ...dataMap });
  const checksum = generateChecksum(payloadString);
  const secureData = JSON.stringify({ payload: payloadString, sig: checksum });

  try {
    // 1. まずはGzip圧縮を試みます（ブラウザが対応している場合）
    if (typeof CompressionStream !== "undefined") {
      const stream = new Blob([secureData]).stream().pipeThrough(new CompressionStream("gzip"));
      const buffer = await new Response(stream).arrayBuffer();
      const binary = String.fromCharCode(...new Uint8Array(buffer));
      return "Z:" + btoa(binary); // 圧縮成功時は先頭に「Z:」を付与
    }
    throw new Error("CompressionStream not supported");
  } catch (err) {
    console.warn("Gzip圧縮に失敗したため、非圧縮（Base64）でコードを生成します:", err);
    // 2. 圧縮に失敗、または未対応の古いブラウザの場合は非圧縮で出力します
    return "R:" + btoa(encodeURIComponent(secureData)); // 非圧縮時は先頭に「R:」を付与
  }
}

/**
 * 引き継ぎコードを自動判別して解凍・検証し、オブジェクトとして返す共通関数
 * @param {string} code - 入力された引き継ぎコード
 * @param {string} expectedGameName - 期待するゲーム名
 */
async function parseSharedTransferCode(code, expectedGameName) {
  let textData = "";
  
  if (code.startsWith("Z:")) {
    // 新方式：Gzip圧縮版の解凍処理
    const binary = atob(code.slice(2));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    textData = await new Response(stream).text();
  } else if (code.startsWith("R:")) {
    // 新方式：非圧縮版の復元処理
    textData = decodeURIComponent(atob(code.slice(2)));
  } else {
    // 【修正】リリース前のため、プレフィックスなしの古いコードは即座にエラーとして弾く
    throw new Error("無効なコード形式です。");
  }

  // データの改ざん・破損チェック
  const secureJson = JSON.parse(textData);
  if (!secureJson.payload || !secureJson.sig) throw new Error("データ形式が不正です。");
  if (generateChecksum(secureJson.payload) !== secureJson.sig) throw new Error("チェックサムが一致しません。");

  // 対象ゲームのチェック（別ゲームのコードを弾く）
  const json = JSON.parse(secureJson.payload);
  if (json.game !== expectedGameName) throw new Error("異なるゲームのデータです。");
  
  return json;
}
