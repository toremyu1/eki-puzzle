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
