// ==========================================
// 駅ロケ専用 管理者パネル (admin.js)
// ==========================================

// 管理者パネルのUI（外枠）を作成し、画面上部に挿入します
const adminPanel = document.createElement('div');
adminPanel.id = 'admin-panel';
adminPanel.style.padding = '10px';
adminPanel.style.background = '#e3f2fd'; // 駅ロケのテーマに合わせた水色系
adminPanel.style.border = '2px solid #2196f3';
adminPanel.style.marginBottom = '15px';
adminPanel.innerHTML = `
<span style="color:#000000;"><b>🛠 駅ロケ 管理者モード</b><br>
現在の答え: [通常] <span id="debug-ans-normal">（読込中...）</span> / [ハード] <span id="debug-ans-hard">（読込中...）</span></span><br>
<input type="text" id="admin-custom-ans" placeholder="新しい答え(駅名/ひらがな)" style="padding:4px; margin-right:5px; width:180px;">
<button id="admin-set-normal-btn" style="margin-right:5px; background:#4caf50; color:#fff; border:none; padding:4px 8px; border-radius:4px;">通常を変更</button>
<button id="admin-set-hard-btn" style="margin-right:5px; background:#e74c3c; color:#fff; border:none; padding:4px 8px; border-radius:4px;">ハードを変更</button>
<button id="admin-reset-btn" style="margin-right:5px;" title="成績や図鑑はそのままに、盤面だけをやり直します">盤面リセット</button>
<button id="admin-stats-wipe-btn" style="background-color:#ffe6e6; color:#c62828; border:1px solid #c62828; padding:3px 8px; border-radius:4px;">戦績全消去</button>
<button id="admin-full-wipe-btn" style="background-color:#b71c1c; color:#fff; border:1px solid #b71c1c; margin-left:5px; padding:3px 8px; border-radius:4px;">データ完全消去</button>

<div style="margin-top:10px; padding:10px; background:#fff3e0; border:1px solid #ff9800; border-radius:4px;">
<span style="color:black;"><b>【全データ一覧＆直接編集】</b></span><br>
<button id="adm-load-all-btn" style="margin-bottom:10px; padding:4px 8px;">全データを読み込んで表示</button>
<div id="adm-all-data-container" style="max-height:400px; overflow-y:auto; background:#fff; padding:5px; border:1px solid #ccc; font-size:12px; color:#333;">ここにデータが表示されます</div>
</div>

<div style="margin-top:10px; padding:10px; background:#f5f5f5; border:1px solid #ddd; border-radius:4px; font-size:12px; color:black; text-align:left;">
<b>【各種カウンター手動編集】</b><br>
図鑑解放数: <input type="text" id="adm-unlocked-count" style="width:50px; background:#e0e0e0; border:1px solid #ccc;" readonly title="解放済みの駅数"> 駅<br>
連続ログイン: <input type="number" id="adm-cur-login-streak" style="width:60px;"> 日 <button id="adm-save-login">保存</button><br>
通常モード最高連勝: <input type="number" id="adm-normal-max-streak" style="width:60px;"> 回 <button id="adm-save-normal-streak">保存</button><br>
エンドレスハイスコア: <input type="number" id="adm-endless-high-score" style="width:100px;"> pts <button id="adm-save-endless-score">保存</button><br>
エンドレス最高コンボ: <input type="number" id="adm-endless-max-combo" style="width:60px;"> 回 <button id="adm-save-endless-combo">保存</button><br>
</div>

<div style="margin-top:10px; padding-top:10px; border-top:1px solid #ccc;">
<select id="admin-event-select" style="padding:4px;">
<option value="">通常（演出オフ）</option>
<option value="newyear">正月（🎍）</option>
<option value="valentine">バレンタイン（🍫）</option>
<option value="hinamatsuri">ひなまつり（🌸）</option>
<option value="kodomo">こどもの日（🎏）</option>
<option value="tanabata">七夕（🎋）</option>
<option value="halloween">ハロウィン（🎃）</option>
<option value="christmas">クリスマス（🎄）</option>
<option value="nye">大晦日（🔔）</option>
</select>
<button id="admin-event-btn" style="padding:4px 8px;">演出テスト</button>
<br>
<button id="admin-offline-banner-btn" style="background:#fff3e0; border:1px solid #ff9800; margin-top:10px; padding:4px 8px;">⚠️ オフライン警告バナーをテスト表示 (ON/OFF)</button>
</div>
`;

// headerタグの直後にパネルを挿入します
const headerEl = document.querySelector('header');
if (headerEl) {
  headerEl.insertAdjacentElement('afterend', adminPanel);
} else {
  document.body.prepend(adminPanel);
}


// ==========================================
// 現在の答えの監視と書き換え処理
// ==========================================
setInterval(() => {
  // 通常モードの答えの監視と上書き
  if (typeof todayLocaStationNormal !== 'undefined' && todayLocaStationNormal !== null) {
    const savedNormal = sessionStorage.getItem('admin_override_ans_normal');
    // セッションに上書きデータがあり、現在の答えと違う場合は上書きを実行
    if (savedNormal && todayLocaStationNormal.kanji !== savedNormal) {
      if (typeof locaStations !== 'undefined') {
        const found = locaStations.find(s => s.kanji === savedNormal || s.hiragana === savedNormal);
        if (found) todayLocaStationNormal = found;
      }
    }
    document.getElementById('debug-ans-normal').textContent = todayLocaStationNormal.kanji;
  }
  
  // ハードモードの答えの監視と上書き
  if (typeof todayLocaStationHard !== 'undefined' && todayLocaStationHard !== null) {
    const savedHard = sessionStorage.getItem('admin_override_ans_hard');
    if (savedHard && todayLocaStationHard.kanji !== savedHard) {
      if (typeof locaStations !== 'undefined') {
        const found = locaStations.find(s => s.kanji === savedHard || s.hiragana === savedHard);
        if (found) todayLocaStationHard = found;
      }
    }
    document.getElementById('debug-ans-hard').textContent = todayLocaStationHard.kanji;
  }
}, 500);


// ==========================================
// リセット処理群
// ==========================================

// 盤面のみをリセットする関数
const resetLocaPlay = () => {
  // 通常・ハードモードの盤面情報を消去
  localStorage.removeItem("ekiLocateStateV2");
  // エンドレスモードの盤面情報を消去
  localStorage.removeItem("ekiLocateEndlessDeck");
  
  // セッションストレージ内の他のゴミも念のため掃除します
  const keys = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k && !k.startsWith('admin_override_ans_')) keys.push(k);
  }
  keys.forEach(k => sessionStorage.removeItem(k));
};

// 答え変更ボタン（通常モード）
document.getElementById('admin-set-normal-btn').addEventListener('click', () => {
  const newAns = document.getElementById('admin-custom-ans').value.trim();
  if (newAns !== '') {
    const found = locaStations.find(s => s.kanji === newAns || s.hiragana === newAns);
    if (!found) { alert('エラー：その駅は辞書データに存在しません。'); return; }
    
    sessionStorage.setItem('admin_override_ans_normal', found.kanji);
    resetLocaPlay();
    alert('通常モードの答えを変更し、盤面をリセットしました。'); 
    location.reload();
  }
});

// 答え変更ボタン（ハードモード）
document.getElementById('admin-set-hard-btn').addEventListener('click', () => {
  const newAns = document.getElementById('admin-custom-ans').value.trim();
  if (newAns !== '') {
    const found = locaStations.find(s => s.kanji === newAns || s.hiragana === newAns);
    if (!found) { alert('エラー：その駅は辞書データに存在しません。'); return; }
    
    sessionStorage.setItem('admin_override_ans_hard', found.kanji);
    resetLocaPlay();
    alert('ハードモードの答えを変更し、盤面をリセットしました。'); 
    location.reload();
  }
});

// 盤面リセットボタン
document.getElementById('admin-reset-btn').addEventListener('click', () => {
  resetLocaPlay();
  location.reload();
});

// 戦績のみ消去ボタン
document.getElementById('admin-stats-wipe-btn').addEventListener('click', () => {
  if (confirm('勝率や連勝記録、ハイスコアなどの「戦績データ」のみを初期化します。よろしいですか？')) {
    localStorage.removeItem('ekiLocateStatsV2');
    localStorage.removeItem('ekiLocateEndlessHighScore');
    localStorage.removeItem('ekiLocateEndlessMaxCombo');
    location.reload();
  }
});

// データ完全消去ボタン
document.getElementById('admin-full-wipe-btn').addEventListener('click', () => {
  if (confirm('【警告】戦績、図鑑、設定など、すべてのセーブデータを完全に消去して初期状態に戻します。本当によろしいですか？')) {
    localStorage.clear();
    sessionStorage.clear();
    alert('すべてのデータを完全に消去しました。');
    location.reload();
  }
});


// ==========================================
// 全データの直接編集機能
// ==========================================
document.getElementById('adm-load-all-btn').addEventListener('click', () => {
  const container = document.getElementById('adm-all-data-container');
  container.innerHTML = '';
  let found = false;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    // 駅ロケのデータ（ekiLocate〜）のみを抽出して表示します
    if (key.startsWith('ekiLocate')) {
      found = true;
      let val = localStorage.getItem(key);
      let displayVal = val;
      
      // JSON形式の場合は見やすく改行して表示します
      try { displayVal = JSON.stringify(JSON.parse(val), null, 2); } catch(e) {}
      
      const block = document.createElement('div');
      block.style.marginBottom = '15px';
      block.style.borderBottom = '1px dashed #ccc';
      block.style.paddingBottom = '10px';
      
      block.innerHTML = `
        <div style="font-weight:bold; color:#1976d2; margin-bottom:5px;">${key}</div>
        <textarea id="edit-${key}" style="width:100%; height:100px; font-family:monospace; font-size:12px; margin-bottom:5px;">${displayVal}</textarea>
        <div style="text-align:right;">
          <button id="save-${key}" style="background-color:#e3f2fd; color:#1565c0; padding:4px 10px; border:1px solid #1976d2; border-radius:4px;">上書き保存</button>
        </div>
      `;
      container.appendChild(block);
      
      // 上書き保存の動作
      document.getElementById(`save-${key}`).addEventListener('click', () => {
        const newVal = document.getElementById(`edit-${key}`).value;
        try {
          // JSONの記号から始まる場合は、念のためフォーマットが壊れていないかチェック
          if (newVal.trim().startsWith('{') || newVal.trim().startsWith('[')) JSON.parse(newVal);
          localStorage.setItem(key, newVal);
          alert(key + " を上書き保存しました。");
        } catch(e) {
          alert("エラー：正しいJSON形式ではありません。記号の抜け落ちなどを確認してください。");
        }
      });
    }
  }
  if (!found) container.innerHTML = '保存データがありません。';
});


// ==========================================
// 各種カウンターの読み込みと手動保存機能
// ==========================================
setTimeout(() => {
  // メタデータ（連続ログインや図鑑）
  let metaData = JSON.parse(localStorage.getItem("ekiLocateMeta") || '{"consecutiveLoginDays":0, "unlockedStations":[]}');
  // 戦績データ
  let statsData = JSON.parse(localStorage.getItem("ekiLocateStatsV2") || '{"normal":{"maxStreak":0}}');
  // エンドレスモードのスコアデータ
  let endlessScore = parseInt(localStorage.getItem("ekiLocateEndlessHighScore") || "0", 10);
  let endlessCombo = parseInt(localStorage.getItem("ekiLocateEndlessMaxCombo") || "0", 10);
  
  // inputタグに現在の数値を流し込みます
  document.getElementById("adm-unlocked-count").value = (metaData.unlockedStations) ? metaData.unlockedStations.length : 0;
  document.getElementById("adm-cur-login-streak").value = metaData.consecutiveLoginDays || 0;
  document.getElementById("adm-normal-max-streak").value = (statsData.normal && statsData.normal.maxStreak) ? statsData.normal.maxStreak : 0;
  document.getElementById("adm-endless-high-score").value = endlessScore;
  document.getElementById("adm-endless-max-combo").value = endlessCombo;
  
  // 連続ログイン日数の上書き
  document.getElementById("adm-save-login").addEventListener("click", () => {
    metaData.consecutiveLoginDays = parseInt(document.getElementById("adm-cur-login-streak").value, 10) || 0;
    localStorage.setItem("ekiLocateMeta", JSON.stringify(metaData)); 
    alert("保存しました。"); 
    location.reload();
  });
  
  // 通常モード最高連勝回数の上書き
  document.getElementById("adm-save-normal-streak").addEventListener("click", () => {
    if (!statsData.normal) statsData.normal = { maxStreak: 0 };
    statsData.normal.maxStreak = parseInt(document.getElementById("adm-normal-max-streak").value, 10) || 0;
    localStorage.setItem("ekiLocateStatsV2", JSON.stringify(statsData)); 
    alert("保存しました。"); 
    location.reload();
  });
  
  // エンドレスハイスコアの上書き
  document.getElementById("adm-save-endless-score").addEventListener("click", () => {
    localStorage.setItem("ekiLocateEndlessHighScore", document.getElementById("adm-endless-high-score").value);
    alert("保存しました。"); 
    location.reload();
  });
  
  // エンドレス最高コンボの上書き
  document.getElementById("adm-save-endless-combo").addEventListener("click", () => {
    localStorage.setItem("ekiLocateEndlessMaxCombo", document.getElementById("adm-endless-max-combo").value);
    alert("保存しました。"); 
    location.reload();
  });
  
}, 500); // 念のため、セーブデータが展開されるのを0.5秒待ってから読み込みます


// ==========================================
// 演出テスト機能（行事日・オフラインバナー）
// ==========================================

// 行事日エフェクトテスト
document.getElementById('admin-event-btn').addEventListener('click', () => {
  const ev = document.getElementById('admin-event-select').value;
  // app.js に定義されている行事日呼び出し関数を強制実行します
  if (typeof triggerLocaEvent === "function") {
    triggerLocaEvent(ev);
  } else {
    alert("エラー：イベント関数（triggerLocaEvent）が見つかりません。");
  }
});

// オフライン警告バナーのテスト表示
document.getElementById('admin-offline-banner-btn').addEventListener('click', () => {
  const existingBanner = document.getElementById("offline-warning-banner");
  
  if (existingBanner) {
    // 既にある場合は消す
    existingBanner.remove();
  } else {
    // ない場合は header の先頭に挿入する
    const header = document.querySelector("header");
    if (header) {
      header.insertAdjacentHTML("afterbegin", `
        <div id="offline-warning-banner" style="background-color: #fff3e0; color: #e65100; font-size: 11px; font-weight: bold; text-align: center; padding: 6px; border-bottom: 1px solid #ffcc80; width: 100%; box-sizing: border-box;">
          ⚠️ [テスト] バックアップデータで運行中。最新の駅情報と異なる場合があります。
        </div>
      `);
    } else {
      alert("エラー：ヘッダー要素が見つかりません。");
    }
  }
});
