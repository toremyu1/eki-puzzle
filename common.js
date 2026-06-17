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

// 1. プログレスバーの更新を共通化
// IDを柔軟に指定できるようにし、どのゲームのロード画面でも動くようにします
function updateSharedLoading(percent, text, barId = "circular-progress-bar", textId = "loading-text", pctId = "loading-percentage") {
  const bar = document.getElementById(barId);
  const textEl = document.getElementById(textId);
  const pctEl = document.getElementById(pctId);

  if (textEl && text) textEl.textContent = text;
  if (pctEl) pctEl.textContent = `${Math.floor(percent)}%`;
  
  // 円形プログレスバーのグラデーション更新
  if (bar) bar.style.background = `conic-gradient(#3498db ${percent}%, #e2e8f0 ${percent}%)`;
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
