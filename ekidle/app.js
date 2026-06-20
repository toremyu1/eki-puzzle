//1.共通変数の定義　
const SITE_OPEN_DATE = "2025-06-25";　 // 【設定】サイトを公開した日（周年記念の基準日）
const FALLBACK_URL = "/stationdle";  // 【設定】読み込みエラー時に戻るルートフォルダのURL
const CONFIG_MAX_GUESSES_4 = 8;     // 4文字モードの回答回数
const CONFIG_MAX_GUESSES_5 = 6;     // 5文字モードの回答回数
const CONFIG_MAX_GUESSES_6 = 6;     // 6文字モードの回答回数
const CONFIG_MAX_GUESSES_QUAD = 13; // クアッドモードの回答回数

let stations=[];　　　　　　　//すべての駅データの入れる箱
let availableStations=[];　　//選択文字数に一致する駅を入れる箱
let todayStation=null;　　　 //今日の正解駅
let currentGuess="";　　　　 //プレイヤーが入力している途中の文字を記憶する箱
let guessesSubmitted=0;　　　//プレイヤーの回答送信回数カウンター 
let maxGuesses=8;　　　　　　//上限回答数(文字数により変動)
let rowLength=4;　　　　　　 //入力パネルの文字数
let currentMode=4;　　　　　 //現在遊んでいるモードの文字数
let keyColors={};　　　　　　//キーボードの各ボタンについている色を記憶する箱
let gridHistory=[];         //プレイヤーが送信した過去の回答の色の結果を履歴として残す箱
let debugOffset=0;　　　　　 //デバッグ時に日付を強制的にずらすための数値
let msgTimeout=null;　　　　 //画面にポップアップを出した後、自動で消すためのタイマー
let currentDayIndex=0;　　　 //基準日から数えて今日が何日目かを表す数字
let isAprilFoolMode=false;　 //今がエイプリルフール限定モードを判定するためのフラグ
let isPlayingRandom=false;   // ランダムモード中かどうかの判定フラグ
let savedState={};　　　　　　//各文字のモードで今日のゲームの途中経過を保存する箱
let todayStationCache={};    // 今日の答えをキャッシュに保存する箱
let ekiSettings=JSON.parse(localStorage.getItem("ekiSettings")||'{"theme":"","sound":true,"fontSize":"normal","hardMode":false}');　　　//ユーザー設定を保存する箱
// let ekiLoginStreak=JSON.parse(localStorage.getItem("ekiLoginStreak")||'{"currentStreak":0,"maxStreak":0,"lastLoginDate":""}');　　//連続ログイン日数を保存する箱（ekiZukanMetaに統合するため廃止）
// let ekiClearedDays=JSON.parse(localStorage.getItem("ekiClearedDays")||'{"4":[],"5":[],"6":[]}');　　　//クリアした日を保存する箱　(ekiPuzzleStateV1_LogのisWinを調べれば復元できるため廃止)
let ekiAchievements=JSON.parse(localStorage.getItem("ekiAchievements")||'{"bestScores":{},"counters":{"legendStationClears":0,"noAbsentClears":0,"totalYomiLength":0,"noHintClears":0,"hintUsedClears":0,"totalSubmitCount":0},"winStreak":{"currentStreak":0,"maxStreak":0,"lastClearedDate":""},"hourlyClears":{},"unlockedSets":{"prefs":[],"companies":[],"lines":[],"colorCounts":{"4":{"correct":0,"present":0,"diacritic":0,"absent":0}},"clearedEvents":[],"clearedMonthDays":[],"clearedStationNames":[]}}');　　// 実績データの全体構造を定義
//各文字数モード毎の累計プレイ回数、勝率、連勝記録、最大連勝、何回目で当たったかを記録する箱
let userStats={　　　　　　　
4:{played:0,won:0,currentStreak:0,maxStreak:0,dist:[0,0,0,0,0,0,0,0,0,0]},
5:{played:0,won:0,currentStreak:0,maxStreak:0,dist:[0,0,0,0,0,0,0,0,0,0]},
6:{played:0,won:0,currentStreak:0,maxStreak:0,dist:[0,0,0,0,0,0,0,0,0,0]}
};
// 過去に解いた問題を記録しておく箱（後から復元可能なため廃止）
// let dailyArchive={};


// ==========================================
// 1. システム初期化（心臓部）
// ==========================================
async function initGame() {
  try {
    // 共通関数を使って進捗バーを動かす
    updateSharedLoading(10, "システムを起動中...");

    // URLパラメーターによるデータ初期化機能
    if (new URLSearchParams(window.location.search).get("emergency_reset") === "true") {
      if (confirm("これまでのプレイ実績や設定がすべて消去されます。本当に初期化しますか？")) {
        localStorage.clear();
        alert("データを初期化しました。");  
      }
      window.location.href = window.location.origin + window.location.pathname;
      return;
    }

    // 過去のセーブデータの読み込み
    loadStats();
    // if(typeof loadArchive === "function") loadArchive();
    
    // 共通関数を使って連続ログイン日数を計算し、データを更新する
    // let streakData = updateSharedLoginStreak("ekiLoginStreak");
    // 【修正後】アーカイブ読み込みを消し、保存先を ekiZukanMeta に変更します
    // 図鑑のメタデータ（ekiZukanMeta）にログイン機能を集約させます
    let streakData = updateSharedLoginStreak("ekiZukanMeta");
    
    updateSharedLoading(30, "駅データをダウンロード中...");

    // 共通関数を使って、強力なキャッシュ・エラー対策付きのデータ取得を行う
    const rawData = await downloadSharedGameData("eki-backup-v1", FALLBACK_URL);
    if (!rawData) return; // 取得失敗時は共通関数内でエラー画面が出るため処理を止める

    // 共通関数を使って不要な駅（貨物駅など）を弾き、ひらがな化の独自処理を足す
    stations = getCleanStations(rawData).map(s => ({...s, yomi: toHiragana(s.yomi)}));
    if (stations.length === 0) return;

    updateSharedLoading(60, "画面を準備中...");

    // UIの紐付け関数を実行
    setupCommonUI();
    setupGameSpecificUI();

    // 今日の正解駅を選び、盤面を構築する
    updateSharedLoading(80, "ゲーム盤を構築中...");
    await selectTodayStation(); 
    restoreBoard(); 

    updateSharedLoading(100, "出発進行！");
    setTimeout(hideLoadingScreen, 600);

  } catch (e) {
    console.error("起動エラー:", e);
  }
}


// ==========================================
// 共通UI制御処理
// ==========================================
function setupCommonUI() {
  // 1. 共通関数の呼び出し（これだけでメニューやモーダルが動きます）
  setupSharedSideMenu("menu-btn", "side-menu", "side-menu-overlay", "close-menu-btn");
  // ▼▼▼ 修正：「help-btn」の固定紐付けを解除し、各モーダルは閉じるボタンのみ設定します ▼▼▼
  setupSharedModal("", "help-modal", "close-help-btn");
  setupSharedModal("", "result-modal", "close-modal-btn");    
  setupSharedModal("", "quad-help-modal", "close-quad-help-btn");
  setupSharedModal("", "quad-result-modal", "close-quad-modal-btn");

  // 「？」ボタンが押された時、現在のモードに応じて表示するモーダルを切り替えます
  document.getElementById("help-btn")?.addEventListener("click", () => {
    if (isQuadMode) {
      // クアッドモード中は専用の説明画面を開く
      document.getElementById("quad-help-modal")?.classList.remove("hidden");
    } else {
      // 通常モード中は通常の説明画面を開く
      document.getElementById("help-modal")?.classList.remove("hidden");
    }
  });
  
  // 2. タイトル画面とゲーム画面の遷移制御（駅ドル専用の処理なので残す）
  const returnToTitleScreen = () => {
    const titleScreen = document.getElementById("title-screen");
    const gameScreen = document.getElementById("game-screen");
    if (titleScreen && gameScreen) {
      titleScreen.classList.remove("hidden");
      titleScreen.style.display = ""; 
      gameScreen.classList.add("hidden");
      const modeSelector = document.querySelector(".mode-selector");
      if (modeSelector) modeSelector.classList.add("hidden");
      const hardmodeContainer = document.querySelector(".hardmode-container");
      if (hardmodeContainer) hardmodeContainer.classList.add("hidden");
      
      // メニューを閉じる処理（共通UIに無いので手動で隠す）
      document.getElementById("side-menu").style.right = "-250px";
      setTimeout(() => document.getElementById("side-menu-overlay").classList.add("hidden"), 300);
    }
  };

  // 各種ボタンの紐付け
  const btnNormalMode = document.getElementById("btn-normal-mode");
  if (btnNormalMode) {
    // 盤面の再構築（await）を待つために、async を追加する
    btnNormalMode.addEventListener("click", async () => {
      // 1. クアッドモードの状態を完全に解除する
      isQuadMode = false;
      
      // 2. 画面の表示・非表示を通常モード用に切り替える
      document.getElementById("title-screen")?.classList.add("hidden");
      document.getElementById("game-screen")?.classList.remove("hidden");
      
      // 通常盤面を表示し、クアッド盤面を隠す
      document.getElementById("game-board")?.classList.remove("hidden");
      document.getElementById("quad-board-container")?.classList.add("hidden");
      document.getElementById("expand-toggle-btn")?.classList.add("hidden");
      
      // 文字数セレクターとハードモードスイッチを表示する
      document.querySelector(".mode-selector")?.classList.remove("hidden");
      document.querySelector(".hardmode-container")?.classList.remove("hidden");

      
      // ▼▼▼ 追加：現在の文字数に合わせて通常モードの変数を設定し直し、盤面を再構築する ▼▼▼
      if (currentMode === 4) maxGuesses = CONFIG_MAX_GUESSES_4;
      else if (currentMode === 5) maxGuesses = CONFIG_MAX_GUESSES_5;
      else if (currentMode === 6) maxGuesses = CONFIG_MAX_GUESSES_6;
      rowLength = currentMode;
      
      const gameBoard = document.getElementById("game-board");
      if(gameBoard) {
        // HTMLの枠の数を更新する
        gameBoard.style.setProperty("--row-length", currentMode);
        gameBoard.style.setProperty("--row-count", maxGuesses);
      }
      
      // 駅の再抽選と盤面の初期化を確実に実行する
      await selectTodayStation(); 
      restoreBoard();
      // ▲▲▲ 追加ここまで ▲▲▲

      if (typeof checkSpecialEvent === "function") checkSpecialEvent();
    });
  }

    // 【修正】タイトル画面からクアッドモードを起動する処理
    document.getElementById("btn-quad-mode")?.addEventListener("click", async () => {
    document.getElementById("title-screen").classList.add("hidden");
    document.getElementById("game-screen").classList.remove("hidden");
    // ▼▼▼ この1行を追加（クアッドモードでも4, 5, 6文字を選べるようにする） ▼▼▼
    document.querySelector(".mode-selector")?.classList.remove("hidden");
    // ▼▼▼ この1行を追加（クアッド用の回答回数を確実にセットする） ▼▼▼
    maxGuesses = CONFIG_MAX_GUESSES_QUAD;
  
    await startQuadMode();
  
    // ▼▼▼ 修正：1日1回だけ自動でクアッド用の説明モーダルを開く処理 ▼▼▼
    const todayStr = getJSTDateString(); // 日本時間の今日の日付を取得
    const hasSeenHelpToday = localStorage.getItem("ekiQuadHelpSeen") === todayStr;

    if (!hasSeenHelpToday) {
      const helpModal = document.getElementById("quad-help-modal");
      if (helpModal) {
        helpModal.classList.remove("hidden");
        localStorage.setItem("ekiQuadHelpSeen", todayStr); // 今日表示した日付を保存
      }
    }
    // ▲▲▲ 修正ここまで ▲▲▲
  });

  const homeBtn = document.getElementById("home-btn");
  if (homeBtn) {
    homeBtn.addEventListener("click", () => {
      const gameScreen = document.getElementById("game-screen");
      if (gameScreen && !gameScreen.classList.contains("hidden")) returnToTitleScreen();
      else if (typeof FALLBACK_URL !== "undefined") window.location.href = FALLBACK_URL;
    });
  }

// 【修正後】以下のコードに差し替えてください
  const themeBtn = document.getElementById("theme-btn");
  if (themeBtn) {
    // CSSに登録されているテーマのリスト（空文字はデフォルトの白テーマ）
    const themeList = ["", "theme-dark", "theme-sakura", "theme-ocean", "theme-blue", "theme-green", "theme-orange", "theme-red", "theme-purple"];
    
    // 起動時に、保存されているテーマがあれば適用する
    if (ekiSettings.theme) document.body.classList.add(ekiSettings.theme);

    themeBtn.addEventListener("click", () => {
      // 現在のbodyのクラスから、現在のテーマを特定する
      let currentTheme = themeList.find(t => t !== "" && document.body.classList.contains(t)) || "";
      // 次のテーマの順番を計算する（最後まで行ったら最初に戻る）
      let nextIndex = (themeList.indexOf(currentTheme) + 1) % themeList.length;
      let nextTheme = themeList[nextIndex];
      
      // 切り替え時のアニメーションのガタつきを防ぐ
      document.body.classList.add('preload-transitions');
      
      // 古いテーマを消して、新しいテーマを適用する
      themeList.forEach(t => { if (t !== "") document.body.classList.remove(t); });
      if (nextTheme !== "") document.body.classList.add(nextTheme);
      
      // ブラウザに高さを再計算させてから、ガタつき防止を解除する
      document.body.offsetHeight; 
      document.body.classList.remove('preload-transitions');
      
      // ユーザー設定としてローカルストレージに保存する
      ekiSettings.theme = nextTheme;
      localStorage.setItem("ekiSettings", JSON.stringify(ekiSettings));
    });
  }

  document.getElementById("menu-home-btn")?.addEventListener("click", (e) => { e.preventDefault(); returnToTitleScreen(); });
  document.getElementById("menu-top-btn")?.addEventListener("click", (e) => { e.preventDefault(); if (typeof FALLBACK_URL !== "undefined") window.location.href = FALLBACK_URL; });

  
  // 運行記録ボタン
  // 1箇所目：タイトル画面の「運行記録を見る」ボタン
  document.getElementById("btn-stats-title")?.addEventListener("click", () => {
    const statsModal = document.getElementById("title-stats-modal");
    if (statsModal) statsModal.classList.remove("hidden");
    // ▼ この1行を追加（開いた瞬間に計算する）
    if(typeof updateTitleStatsDisplay === "function") updateTitleStatsDisplay("normal");
  });

  // 2箇所目：前回追加した、サイドメニューの「運行記録を見る」ボタン
  document.getElementById("menu-stats-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    // サイドメニュー本体はアニメーションで右にスライドして隠す
    document.getElementById("side-menu").style.right = "-250px";
    // 【修正】300ミリ秒待たずに、黒幕（オーバーレイ）を即座に消して二重被りを防ぐ
    document.getElementById("side-menu-overlay").classList.add("hidden");
    
    const statsModal = document.getElementById("title-stats-modal");
    if (statsModal) statsModal.classList.remove("hidden");
    // ▼ この1行を追加（開いた瞬間に計算する）
    if(typeof updateTitleStatsDisplay === "function") updateTitleStatsDisplay("normal");
  });

  // 運行記録モーダルの×ボタンを確実に動かす処理を追加
  document.getElementById("close-title-stats-btn")?.addEventListener("click", () => {
    document.getElementById("title-stats-modal")?.classList.add("hidden");
  });
  
  // タブ切り替え処理
  document.getElementById("tab-normal")?.addEventListener("click", () => { if(typeof updateTitleStatsDisplay === "function") updateTitleStatsDisplay("normal"); });
  document.getElementById("tab-hard")?.addEventListener("click", () => { if(typeof updateTitleStatsDisplay === "function") updateTitleStatsDisplay("hard"); });
  document.getElementById("tab-quad")?.addEventListener("click", () => { if(typeof updateTitleStatsDisplay === "function") updateTitleStatsDisplay("quad"); });
}

// 入力ボタンやモード切替など、駅ドル固有のUI
function setupGameSpecificUI() {
  // キーボード・入力ボタンの処理
  document.getElementById("enter-btn")?.addEventListener("click", () => handleKeyPress("ENTER"));
  document.getElementById("back-btn")?.addEventListener("click", () => handleKeyPress("BACK"));
  document.getElementById("clear-btn")?.addEventListener("click", () => handleKeyPress("CLEAR"));
  // ▼▼▼ ここから追加：クアッドモード専用の一括展開・縮小ボタンの処理 ▼▼▼
  // 【修正後】展開ボタンのイベント処理
  document.getElementById("expand-toggle-btn")?.addEventListener("click", () => {
    if (!isQuadMode || guessesSubmitted === 0) return;
    
    let allPastRows = [];
    for (let b = 0; b < 4; b++) {
      const board = document.getElementById(`board-${b}`);
      if (!board) continue;
      // board-rowクラスを持つ過去の行だけを正確に集める
      const rows = Array.from(board.children).filter(r => r.classList.contains("board-row"));
      for (let i = 0; i < guessesSubmitted; i++) {
        if (rows[i]) allPastRows.push(rows[i]);
      }
    }

    if (allPastRows.length === 0) return;

    const isExpanding = allPastRows.some(row => !row.classList.contains("force-expand"));
    isQuadExpanded = isExpanding; // ★現在の展開状態をフラグに保存

    allPastRows.forEach(row => {
      if (isExpanding) {
        row.classList.add("force-expand");
      } else {
        row.classList.remove("force-expand");
      }
    });

    // クアッドモードのセーブデータに現在の展開状態を保存します
    let stateKey = "quad" + currentMode;
    if (savedState[stateKey]) {
      savedState[stateKey].isExpanded = isQuadExpanded;
      saveGameState(); // ローカルストレージへ保存を実行します
    }

    updateTiles(); // ★新しい回答行にも状態を即座に反映させる
  });
  
  // クアッド用のシェアボタン紐付け
  document.getElementById("quad-share-btn")?.addEventListener("click", () => shareQuadResult("twitter"));
  document.getElementById("quad-line-btn")?.addEventListener("click", () => shareQuadResult("line"));
  document.getElementById("quad-fb-btn")?.addEventListener("click", () => shareQuadResult("facebook"));
  document.getElementById("quad-copy-btn")?.addEventListener("click", () => shareQuadResult("copy"));
  
  // 「グラフ」ボタンの処理
  document.getElementById("stats-btn")?.addEventListener("click", () => {
    // ▼▼▼ ここから修正 ▼▼▼
    if (isQuadMode) {
      const isAllCleared = quadSolved.every(s => s === true);
      // クアッドが終了している場合のみ、クアッド専用モーダルを開く
      if (isAllCleared || guessesSubmitted >= maxGuesses) {
        if (typeof showQuadResultModal === "function") showQuadResultModal();
      } else {
        showMessage("ゲームクリア後に見ることができます");
      }
      return;
    }

    // 通常モードの処理
    let st = savedState[isPlayingRandom ? "random" : currentMode];
    if (st && st.isOver) showResultModal(st.isWin, true);
    else showMessage("ゲームクリア後に見ることができます");
    // ▲▲▲ ここまで修正 ▲▲▲
  });

 // モード切替ボタン（4文字・5文字・6文字）
  [4, 5, 6].forEach(num => {
    const modeBtn = document.getElementById(`mode-${num}`);
    if (modeBtn) {
      modeBtn.addEventListener("click", async () => {
        isPlayingRandom = false; 
        isAprilFoolMode = false; 

        currentMode = num; rowLength = num; 
        if (num === 4) maxGuesses = CONFIG_MAX_GUESSES_4;
        else if (num === 5) maxGuesses = CONFIG_MAX_GUESSES_5;
        else if (num === 6) maxGuesses = CONFIG_MAX_GUESSES_6;

        document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
        modeBtn.classList.add("active");

        // ▼▼▼ 修正箇所：現在のモードに応じて再スタートの処理を分ける ▼▼▼
        if (isQuadMode) {
          // クアッドモードのまま文字数を変えて再スタート
          maxGuesses = CONFIG_MAX_GUESSES_QUAD;
          await startQuadMode();
        } else {
          // 通常モードとして再スタート
          document.getElementById("quad-board-container")?.classList.add("hidden");
          document.getElementById("game-board")?.classList.remove("hidden");
          const hs = document.getElementById("hardmode-switch");
          if (hs) hs.disabled = false;
          
          const gameBoard = document.getElementById("game-board");
          if(gameBoard) {
            gameBoard.style.setProperty("--row-length", num);
            gameBoard.style.setProperty("--row-count", maxGuesses);
          }
          await selectTodayStation(); 
          restoreBoard();
        }
        // ▲▲▲ 修正箇所ここまで ▲▲▲
      });
    }
  });

  // シェアボタンの処理（各プラットフォームに振り分け）
  const btnIds = ["share-btn", "line-btn", "fb-btn", "copy-btn"];
  const actions = ["twitter", "line", "facebook", "copy"];
  btnIds.forEach((id, idx) => {
    document.getElementById(id)?.addEventListener("click", () => shareResult(actions[idx]));
  });

  // データのインポート・エクスポート
  document.getElementById("export-data-btn")?.addEventListener("click", (e) => { e.preventDefault(); exportUserData(); });
  document.getElementById("import-data-btn")?.addEventListener("click", (e) => {
    e.preventDefault(); 
    const code = prompt("引き継ぎコードを入力：");
    if (code) importUserData(code);
  });
  
  // ハードモードボタンの処理
  const hardSwitch = document.getElementById("hardmode-switch");
  if (hardSwitch) {
    hardSwitch.addEventListener("click", (e) => {
      let stateKey = isPlayingRandom ? "random" : currentMode;
      let currentSt = savedState[stateKey];
      
      // ゲームが既に終了（クリアor失敗）している場合
      if (currentSt && currentSt.isOver) {
        e.preventDefault();
        // チェック状態を元に戻す
        hardSwitch.checked = !hardSwitch.checked;
        showMessage("ゲーム終了後は変更できません");
        return;
      }

      let isMidGame = currentSt && currentSt.guesses && currentSt.guesses.length > 0 && !currentSt.isOver;
      // プレイ途中のハードモードへ切り替えを禁止する
      if (isMidGame && hardSwitch.checked) {
        e.preventDefault();
        hardSwitch.checked = false;
        showMessage("プレイ開始後はハードモードに変更できません");
      } else {
        ekiSettings.hardMode = hardSwitch.checked;
        localStorage.setItem("ekiSettings", JSON.stringify(ekiSettings));
        // ノーマルモードはプレイ途中の変更も許可する
        if (isMidGame && !hardSwitch.checked) {
          currentSt.isHardMode = false;
          if (!isPlayingRandom) saveGameState();    //ノーマルモードとして記録する
        }
        
        if (typeof updateHelpContent === "function") updateHelpContent();
      }
    });
  }
}


// 【修正後】 各文字数（4, 5, 6文字）のデータを一度に集計・表示する運行記録更新関数
function updateTitleStatsDisplay(modeType) {
  // タブボタン要素の取得
  const tabNormal = document.getElementById("tab-normal");
  const tabHard = document.getElementById("tab-hard");
  const tabQuad = document.getElementById("tab-quad"); 

  // 全タブのスタイルを一旦リセット
  [tabNormal, tabHard, tabQuad].forEach(t => { if(t) t.className = "btn btn-small btn-outline"; });

  // 選択されたタブに応じた色の強調表示
  if (modeType === "normal") {
    if (tabNormal) tabNormal.className = "btn btn-small btn-green-outline";
  } else if (modeType === "hard") {
    if (tabHard) tabHard.className = "btn btn-small btn-danger";
  } else if (modeType === "quad") {
    if (tabQuad) tabQuad.className = "btn btn-small btn-primary"; 
  }

  // 4, 5, 6文字それぞれのデータをループで取得し、それぞれの表示枠へ一斉に流し込みます
  [4, 5, 6].forEach(num => {
    let targetMode = num.toString();
    if (modeType === "hard") {
      targetMode += "_hard";
    } else if (modeType === "quad") {
      targetMode = "quad" + num;
    }

    // セーブデータから該当モードの戦績を読み出し（存在しない場合は初期値）
    let st = userStats[targetMode] || { played: 0, won: 0, currentStreak: 0, maxStreak: 0, guesses: [] };
    let winRate = st.played > 0 ? Math.round((st.won / st.played) * 100) : 0;

    // 対応する文字数のHTML要素に数値を代入
    const elPlayed = document.getElementById(`ts-${num}-played`);
    const elWinrate = document.getElementById(`ts-${num}-winrate`);
    const elStreak = document.getElementById(`ts-${num}-streak`);
    const elMaxstreak = document.getElementById(`ts-${num}-maxstreak`);

    if (elPlayed) elPlayed.textContent = st.played;
    if (elWinrate) elWinrate.textContent = winRate;
    if (elStreak) elStreak.textContent = st.currentStreak;
    if (elMaxstreak) elMaxstreak.textContent = st.maxStreak;
  });
}

    
// ==========================================
// 連続ログイン日数処理（ekiZukanMetaに統合するため廃止）
// ==========================================
// unction updateLoginStreak() {
  // 共通関数に保存先の名前（ekiLoginStreak）を渡すだけで全て自動でやってくれます
//   let updatedData = updateSharedLoginStreak("ekiLoginStreak");
// }

    



// ==========================================
// 文字数判定
// ==========================================

//キーボード表示色優先順位（緑＞黄＞紫＞灰）
const colorPriority={"correct":4,"present":3,"diacritic":2,"absent":1};
const colorToEmoji={"correct":"🟩","present":"🟨","diacritic":"🟪","absent":"⬛"};
//濁点（が）・半濁点（ぱ）・小文字（ゃ）を元の文字（か、は、やなど）に変換するための対応表
const baseMap={
"が":"か","ぎ":"き","ぐ":"く","げ":"け","ご":"こ",
"ざ":"さ","じ":"し","ず":"す","ぜ":"せ","ぞ":"そ",
"だ":"た","ぢ":"ち","づ":"つ","で":"て","ど":"と",
"ば":"は","び":"ひ","ぶ":"ふ","べ":"へ","ぼ":"ほ",
"ぱ":"は","ぴ":"ひ","ぷ":"ふ","ぺ":"へ","ぽ":"ほ",
"ぁ":"あ","ぃ":"い","ぅ":"う","ぇ":"え","ぉ":"お",
"っ":"つ","ゃ":"や","ゅ":"ゆ","ょ":"よ","ゎ":"わ"
};
//キーボード（清音）グループ
const seionGroups=[
["あ","い","う","え","お"],["か","き","く","け","こ"],["さ","し","す","せ","そ"],
["た","ち","つ","て","と"],["な","に","ぬ","ね","の"],["は","ひ","ふ","へ","ほ"],
["ま","み","む","め","も"],["や","","ゆ","","よ"],["ら","り","る","れ","ろ"],["わ","ー","を","","ん"]
];
//キーボード（濁音・半濁点・小文字）グループ
const dakuonGroups=[
["が","ぎ","ぐ","げ","ご"],["ざ","じ","ず","ぜ","ぞ"],["だ","ぢ","づ","で","ど"],
["ば","び","ぶ","べ","ぼ"],["ぱ","ぴ","ぷ","ぺ","ぽ"],["ぁ","ぃ","ぅ","ぇ","ぉ"],
["ゃ","","ゅ","","ょ"],["っ","","ゎ","",""]
];
//引数でもらった文字に濁点・半濁点・小文字がある場合、清音に戻して返す
function getBaseChar(c){return baseMap[c]||c;}
//カタカナのフリガナをすべてひらがなに変換する


// ==========================================
// ロード画面（プログレスバー）制御処理
// ==========================================

// 画面上の進捗バーの長さ（％）と、状況を知らせるテキストを更新する関数
function updateLoadingProgress(percent, text) {
  const progressBar = document.getElementById('progress-bar');
  const trainIcon = document.getElementById('train-icon');
  const loadingText = document.getElementById('loading-text');
  
  if (progressBar && trainIcon && loadingText) {
    progressBar.style.width = percent + '%';
    trainIcon.style.left = percent + '%';
    loadingText.innerText = text;
  }
}

// 読み込みが100%になった後、ロード画面全体をふわっと非表示にして削除する関数
function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.classList.add('hidden');
    // CSSのアニメーション（0.5秒）を待ってから、裏側でも完全に非表示にする
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 500);
  }
}




// ==========================================
// パソコン（ブラウザ）へデータを保存・読み込み
// ==========================================

//保存されている過去の戦績データを読み込む
function loadStats(){
  const saved=localStorage.getItem("ekiPuzzleStatsV2");
  if(saved) userStats=JSON.parse(saved);
  
  // 今日の日付文字列を作成（例: "2026-6-5"）
  const d = new Date();
  const todayStr = d.getFullYear() + "-" + (d.getMonth()+1) + "-" + d.getDate();

  // ランダム専用の枠がない、または「前回ランダムを遊んだ日」が今日ではない場合、成績を0にリセットする
  if(!userStats["random"] || userStats["random"].lastDate !== todayStr){
    userStats["random"]={played:0,won:0,currentStreak:0,maxStreak:0,dist:[0,0,0,0,0,0,0,0,0,0], lastDate: todayStr};
    localStorage.setItem("ekiPuzzleStatsV2",JSON.stringify(userStats));
  }
}

//今回のゲーム結果をこれまでのデータに加算して新しく保存する
function saveStats(isWin,actualGuesses){
  let stateKey = isPlayingRandom ? "random" : currentMode;
  let currentState = savedState[stateKey];
  
  // 保存先のキーを決定する（ハードモードなら "4_hard" などの専用の箱にする）
  let targetMode = stateKey;
  if (!isPlayingRandom && currentState && currentState.isHardMode) {
    targetMode = currentMode + "_hard";
  }

  let st = userStats[targetMode];
  if(!st) st = {played:0,won:0,currentStreak:0,maxStreak:0,dist:[0,0,0,0,0,0,0,0,0,0]};
  if(!st.dist) st.dist = [0,0,0,0,0,0,0,0,0,0];
  
  st.played++;
  if(isWin){
    st.won++; 
    st.currentStreak++;
    if(st.currentStreak > st.maxStreak) st.maxStreak = st.currentStreak;
    st.dist[actualGuesses] = (st.dist[actualGuesses] || 0) + 1;
  }else{ 
    st.currentStreak = 0; 
  }
  
  userStats[targetMode] = st;
  localStorage.setItem("ekiPuzzleStatsV2", JSON.stringify(userStats));
}

//過去に遊んだアーカイブ情報を読み込む
// function loadArchive(){
// const saved=localStorage.getItem("ekiPuzzleArchiveV1");
// if(saved) dailyArchive=JSON.parse(saved);
// }
//今日の問題をアーカイブへ保存する
// function saveToArchive(){
// if(!dailyArchive[currentDayIndex]) dailyArchive[currentDayIndex]={};
// dailyArchive[currentDayIndex][currentMode]={kanji:todayStation.kanji, yomi:todayStation.yomi};
// localStorage.setItem("ekiPuzzleArchiveV1",JSON.stringify(dailyArchive));
// }
// ゲームの進行状況を日付ごとに保存・読み込みする処理です
function loadGameState(dayIdx){
  const savedLog=localStorage.getItem("ekiPuzzleStateV1_Log");
  let logData=savedLog?JSON.parse(savedLog):{};
  //let todayStr=new Date().toISOString().split('T')[0];
  // 【修正後】端末のローカル時計で「YYYY-MM-DD」を作成する
  let todayStr = getJSTDateString();
  
  let meta=JSON.parse(localStorage.getItem("ekiZukanMeta")||'{"totalLogins":0,"lastLoginDate":"","firstPlayDate":""}');
  
  if(!meta.firstPlayDate) meta.firstPlayDate=todayStr;
  
  if(meta.lastLoginDate!==todayStr){
    meta.totalLogins++;
    meta.lastLoginDate=todayStr;
    localStorage.setItem("ekiZukanMeta",JSON.stringify(meta));
  }
  
  // 過去のセーブデータが存在する場合
  if(logData[dayIdx]){
    savedState=logData[dayIdx];
    // 【安全装置】ハードモード用のセーブ枠が不足していればその場で自動追加する
    ["4_hard", "5_hard", "6_hard", "quad4", "quad5", "quad6"].forEach(k => {
      if(!savedState[k]) {
        // クアッド用の枠の場合は、4つの盤面クリア状態などを記憶する変数を入れる
        if(k.startsWith("quad")) {
          savedState[k] = {guesses:[], guessTimes:[], quadSolved:[false,false,false,false], quadGridHistory:[], isOver:false};
        } else {
          savedState[k] = {guesses:[],guessTimes:[],startTime:null,endTime:null,usedHint:false,isWin:false,isOver:false};
        }
      }
    });
    return;
  }
  
  // 新しく本日のデータ枠を作成（クアッドモードの枠も追加）
  savedState={ 
    date:String(dayIdx), 
    isDaily:true,
    4:{guesses:[],guessTimes:[],startTime:null,endTime:null,usedHint:false,isWin:false,isOver:false}, 
    5:{guesses:[],guessTimes:[],startTime:null,endTime:null,usedHint:false,isWin:false,isOver:false}, 
    6:{guesses:[],guessTimes:[],startTime:null,endTime:null,usedHint:false,isWin:false,isOver:false},
    "4_hard":{guesses:[],guessTimes:[],startTime:null,endTime:null,usedHint:false,isWin:false,isOver:false}, 
    "5_hard":{guesses:[],guessTimes:[],startTime:null,endTime:null,usedHint:false,isWin:false,isOver:false}, 
    "6_hard":{guesses:[],guessTimes:[],startTime:null,endTime:null,usedHint:false,isWin:false,isOver:false},
    "quad4":{guesses:[],guessTimes:[],quadSolved:[false,false,false,false],quadGridHistory:[],isOver:false},
    "quad5":{guesses:[],guessTimes:[],quadSolved:[false,false,false,false],quadGridHistory:[],isOver:false},
    "quad6":{guesses:[],guessTimes:[],quadSolved:[false,false,false,false],quadGridHistory:[],isOver:false}
  };
  logData[dayIdx]=savedState;
  localStorage.setItem("ekiPuzzleStateV1_Log",JSON.stringify(logData));
}

// ==========================================
// 状態保存用の共通関数（確実なセーブ）
// ==========================================
function saveGameState() {
  // ランダムモードのプレイ状況は再読み込みで復元する必要がないため保存しない
  if (isPlayingRandom) return;
  
  // 新方式の履歴ログ用（こちらがページ再読み込み時の復元に絶対必要）
  const savedLog = localStorage.getItem("ekiPuzzleStateV1_Log");
  let logData = savedLog ? JSON.parse(savedLog) : {};
  logData[currentDayIndex] = savedState;
  localStorage.setItem("ekiPuzzleStateV1_Log", JSON.stringify(logData));
}

// ==========================================
// 今日の正解駅を決定する処理
// ==========================================

//今日出題する駅を、日付をもとにした乱数シードにより1つ決定
async function selectTodayStation() {
  const SECRET_SALT = "EkiDoru_Secret_2026!";

  // 1. 日本時間（JST）ベースの日付とインデックスの計算
  const t = new Date();
  const jstMs = t.getTime() + (t.getTimezoneOffset() * 60000) + (9 * 3600000);
  const jstObj = new Date(jstMs); // 後続の計算で使い回すため、この行は残します
  const yearStr = jstObj.getFullYear(); // 今年の西暦を取得
  
  // 先ほど作成した共通関数をここで安全に適用します
  let todayStr = getJSTDateString();

  // 基準日（2024年1月1日）から数えて今日が何日目かを計算
  const todayUTC = Date.UTC(jstObj.getFullYear(), jstObj.getMonth(), jstObj.getDate());
  const baseUTC = Date.UTC(2024, 0, 1);
  currentDayIndex = Math.round((todayUTC - baseUTC) / 86400000) + debugOffset;

  // デバッグ機能で日付がずらされている場合の処理
  if (debugOffset !== 0) {
    const debugDate = new Date(baseUTC + currentDayIndex * 86400000);
    todayStr = debugDate.getUTCFullYear() + "-" + String(debugDate.getUTCMonth() + 1).padStart(2, '0') + "-" + String(debugDate.getUTCDate()).padStart(2, '0');
  }

  loadGameState(currentDayIndex);

  // 2. 【最優先】キャッシュ確認（計算・フィルター前に実施して負荷をゼロにする）
  if (todayStationCache[currentMode] && todayStationCache[currentMode].dayIndex === currentDayIndex) {
    todayStation = todayStationCache[currentMode].station;
    return;
  }

  // 3. 【共通】Pythonと完全一致する「安全な駅プール」の作成
  // （JSON逆引き時の「同名ゴースト駅の誤認」を防ぐため、全ルートで共通使用する）
  const strictModeStations = stations.filter(s => 
    s.yomi.length === currentMode && 
    s.pref && s.pref !== "" && 
    s.companies && s.companies.length > 0 &&
    !(s.companies.length === 1 && s.companies[0] === "日本貨物鉄道") &&
    s.address && s.address !== "" &&
    s.min_km != null &&
    s.is_abolished_confirmed !== true
  );

  if (strictModeStations.length === 0) {
    alert(`エラー: ${currentMode}文字の有効な駅データが見つかりません。`);
    todayStation = {kanji:"えらー", yomi:"えらー"}; 
    return;
  }

  // 4. 【メインルート】answers.jsonの取得と逆引き
  try {
    const res = await fetch(`answers/${yearStr}.json`, { cache: "no-store" });
    if (!res.ok) throw new Error("答えファイルの取得に失敗");
    const answersData = await res.json();

    const targetHash = answersData[todayStr]?.[currentMode];
    if (!targetHash) throw new Error("本日の答えデータがファイル内にありません");

    const calcSha256 = async (str) => {
      const buf = new TextEncoder().encode(str);
      const hashBuf = await crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const hashPromises = strictModeStations.map(async (s) => {
      const sHash = await calcSha256(SECRET_SALT + s.yomi);
      return { station: s, hash: sHash };
    });

    const hashedStations = await Promise.all(hashPromises);
    const foundItem = hashedStations.find(item => item.hash === targetHash);

    if (foundItem) {
      todayStation = foundItem.station;
    } else {
      throw new Error("ハッシュが一致する駅が見つかりません");
    }

  // 5. 【フォールバックルート】通信エラー時はJS側でシミュレーション計算
  } catch (err) {
    console.warn("⚠️ サーバーの答えファイル読み込み失敗。自力でシミュレーション計算します:", err);

    // ユニークな読みの数をカウントし、出禁期間を決定します
    let uniqueYomiCount = new Set(strictModeStations.map(s => s.yomi)).size;
    let lookback = Math.min(1000, Math.floor(uniqueYomiCount * 0.7));

    // ローカルストレージに保存するための専用キーと変数の準備
    let nextAvailableDay = {};
    let startDay = 0;
    const rngStateKey = `ekidle_rng_state_${currentMode}`;

    // ==========================================
    // ① ローカルストレージから前回の計算状態を読み込む（軽量化）
    // ==========================================
    const savedStateStr = localStorage.getItem(rngStateKey);
    if (savedStateStr) {
      try {
        const savedState = JSON.parse(savedStateStr);
        nextAvailableDay = savedState.nextAvailableDay || {};
        // 前回計算した次の日からスタートします
        startDay = (savedState.lastCalculatedDay !== undefined) ? savedState.lastCalculatedDay + 1 : 0;
      } catch (e) {
        console.error("シミュレーション状態の復元に失敗しました", e);
      }
    }

    // ==========================================
    // ② 堅牢な総当たり方式での歴史シミュレーション
    // ==========================================
    for (let d = startDay; d <= currentDayIndex; d++) {
      
      // その日(d)の時点で現役の駅だけを、毎回まっさらな状態から抽出します
      let pool = strictModeStations.filter(s => {
        // まだ開業していない未来の駅なら除外
        if (s.startDay != null && s.startDay > d) return false;
        // 既に廃止された駅なら除外（999999は廃止予定なしの意味）
        if (s.endDay != null && s.endDay !== 999999 && s.endDay <= d) return false;
        // お休み（出禁）期間中なら除外
        if (nextAvailableDay[s.yomi] && nextAvailableDay[s.yomi] > d) return false;
        
        return true;
      });

      // 【安全装置】万が一、条件が厳しすぎてくじ引き箱が空になった場合は全駅を復活させます
      if (pool.length === 0) {
        pool = strictModeStations.filter(s => {
          if (s.startDay != null && s.startDay > d) return false;
          if (s.endDay != null && s.endDay !== 999999 && s.endDay <= d) return false;
          return true;
        });
      }

      // ③ 日付と文字数モードを利用した独自ハッシュによる答えの選出
      let seed = d * 12345 + currentMode * 6789;
      let hash = Math.imul(seed ^ (seed >>> 15), 2246822507);
      hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
      hash = (hash ^ (hash >>> 16)) >>> 0;

      let candidate = pool[hash % pool.length];
      
      // 選ばれた駅の次回の出禁日を帳簿に登録します
      nextAvailableDay[candidate.yomi] = d + lookback + 1;

      // シミュレーションが「今日」に到達したら最終結果として確定します
      if (d === currentDayIndex) {
        todayStation = candidate;
      }
    }
    
    // ==========================================
    // ④ 不要になった過去の出禁データを掃除して保存（移し替え方式）
    // ==========================================
    // 保存用の新しい箱（オブジェクト）を準備し、今日の日付を記録します
    let stateToSave = { 
      lastCalculatedDay: currentDayIndex, 
      nextAvailableDay: {} 
    };
    
    // 古い帳簿から1つずつデータを取り出します
    for (const yomi in nextAvailableDay) {
      // 出禁解除日が「今日より未来」のデータだけを、新しい箱にコピーします
      if (nextAvailableDay[yomi] > currentDayIndex) {
        stateToSave.nextAvailableDay[yomi] = nextAvailableDay[yomi];
      }
    }
    
    // 今日の答え（シミュレーション状態）をローカルに保存します
    localStorage.setItem(rngStateKey, JSON.stringify(stateToSave));
  } // ← catchブロックの終わり
}


// ==========================================
// 入力タイルとキーボード組み立て処理
// ==========================================

//入力タイル（四角いマス目）を画面に並べる処理
function drawBoard(){
const board=document.getElementById("game-board");
document.querySelectorAll(".board-row").forEach(e=>e.remove());
for(let i=0;i<maxGuesses;i++){
const row=document.createElement("div");
row.className="board-row";
row.id=`row-${i}`;
for(let j=0;j<rowLength;j++){
const tile=document.createElement("div");
tile.className="tile";
tile.id=`row-${i}-tile-${j}`;
row.appendChild(tile);
}
board.appendChild(row);
}
}
//全国すべての駅名で実際に使われている文字だけを取り出し、キーボードを作成
function buildKeyboard(){
let allChars=new Set();
stations.forEach(s=>{ for(let c of s.yomi)allChars.add(c); });
const kb=document.getElementById("keyboard");
kb.innerHTML="";
const sTitle=document.createElement("div"); sTitle.className="keyboard-title"; sTitle.textContent="【清音】"; kb.appendChild(sTitle);
const sDiv=document.createElement("div"); sDiv.className="keyboard-section";
seionGroups.slice().reverse().forEach(group=>{
let col=document.createElement("div"); col.className="key-col"; let hasKey=false;
group.forEach(c=>{if(c!==""&&allChars.has(c))hasKey=true;});
if(hasKey){
group.forEach(c=>{
if(c!==""&&allChars.has(c)) col.appendChild(createKey(c));
else { let d=document.createElement("div"); d.className="key dummy"; col.appendChild(d); }
});
sDiv.appendChild(col);
}
});
kb.appendChild(sDiv);
const dTitle=document.createElement("div"); dTitle.className="keyboard-title"; dTitle.textContent="【濁音・半濁音・小文字】"; kb.appendChild(dTitle);
const dDiv=document.createElement("div"); dDiv.className="keyboard-section";
dakuonGroups.slice().reverse().forEach(group=>{
let col=document.createElement("div"); col.className="key-col"; let hasKey=false;
group.forEach(c=>{if(c!==""&&allChars.has(c))hasKey=true;});
if(hasKey){
group.forEach(c=>{
if(c!==""&&allChars.has(c)) col.appendChild(createKey(c));
else { let d=document.createElement("div"); d.className="key dummy"; col.appendChild(d); }
});
dDiv.appendChild(col);
}
});
kb.appendChild(dDiv);
}
//キーボードのボタンを1個作成し、クリックされたらその文字が入力されるようにする
function createKey(char){
let btn=document.createElement("button");
btn.textContent=char;
btn.className="key";
btn.id="key-"+char;
btn.addEventListener("click",()=>handleKeyPress(char));
return btn;
}

//モード変更時、パネルをまっさらにして前回の状態を綺麗に復元する
function restoreBoard(){
  currentGuess=""; guessesSubmitted=0; gridHistory=[]; keyColors={};
  availableStations=stations.filter(s=>s.yomi.length===currentMode);
  drawBoard(); buildKeyboard();
  const box=document.getElementById("message-box");
  if(box) box.classList.add("hidden");
  // モード切り替え時、結果画面にhiddenクラスをつけて確実に隠す
    const modal = document.getElementById("result-modal");
    if (modal) {
      modal.classList.add("hidden");
    }
  let stateKey = isPlayingRandom ? "random" : currentMode;
  let st=savedState[stateKey];
  // セーブデータが存在する場合のみ、過去の回答を盤面に1手ずつ再現して復元します
  if (st && st.guesses) {
    st.guesses.forEach(g=>{ currentGuess=g; submitGuess(true); });
  }
  currentGuess="";
  // 盤面復元時、既にプレイ中であればそのゲームのハードモード状態にスイッチを合わせる
  let currentSt = savedState[isPlayingRandom ? "random" : currentMode];
  // 【修正後】以下のコードにまるごと差し替えてください
  if (currentSt && currentSt.guesses && currentSt.guesses.length > 0) {
    // プレイ途中の場合（セーブデータ側の設定を優先）
    ekiSettings.hardMode = !!currentSt.isHardMode; 
    const hardSwitch = document.getElementById("hardmode-switch");
    if(hardSwitch) {
      hardSwitch.checked = ekiSettings.hardMode;
      hardSwitch.disabled = false;
    }
    localStorage.setItem("ekiSettings", JSON.stringify(ekiSettings));
  } else {
    // まっさらな新しいゲームの場合（現在の設定をチェックボックスに反映）
    const hardSwitch = document.getElementById("hardmode-switch");
    if(hardSwitch) {
      hardSwitch.checked = ekiSettings.hardMode;
      hardSwitch.disabled = false;
    }
  }
  
  // ★必ず最後に説明モーダルの表示を同期させる
  if (typeof updateHelpContent === "function") updateHelpContent(); else {
    // まだ回答していない（新しいゲーム）なら、操作可能にする
    const hardSwitch = document.getElementById("hardmode-switch");
    if(hardSwitch) hardSwitch.disabled = false;
  }
}


// ==========================================
// プレイヤーの入力を処理する
// ==========================================
// キーボードの文字や、特殊ボタン（回答・消去）が押されたときの振り分けを行う
// プレイヤーの入力を処理する
function handleKeyPress(char){
  // 1. クアッドモードと通常モードで、入力ロックとタイマー処理を完全に分離する
  if (isQuadMode) {
    const isAllCleared = quadSolved.every(s => s === true);
    if (isAllCleared || guessesSubmitted >= maxGuesses) return;
  } else {
    let stateKey = isPlayingRandom ? "random" : currentMode;
    let st = savedState[stateKey];
    if(!st || st.isOver || guessesSubmitted >= maxGuesses) return;
    
    // 最初の文字を入力した時のタイマー開始処理（通常モードのみ）
    if(!st.startTime && char !== "BACK" && char !== "CLEAR" && char !== "ENTER"){
      st.startTime = Date.now();
      if(!isPlayingRandom) {
        saveGameState();
      }
    }
  }

  // 2. 実際の文字入力・消去の処理
  if(char === "BACK"){
    if(currentGuess.length > 0){ currentGuess = currentGuess.slice(0, -1); updateTiles(); }
  } else if(char === "CLEAR"){
    currentGuess = ""; updateTiles();
  } else if(char === "ENTER"){
    if(currentGuess.length === rowLength) {
      setTimeout(() => {
        // 3. 【追加】エンターキーを押した時の送信処理も、モードによって確実に振り分ける
        if (isQuadMode) {
          if (typeof submitQuadGuess === "function") submitQuadGuess();
        } else {
          submitGuess(false);
        }
      }, 10);
    } else {
      showMessage(`${rowLength}文字入力してください`);
    }
  } else {
    if(currentGuess.length < rowLength){ currentGuess += char; updateTiles(); }
  }
}

// タイルに入力中文字を表示し、クアッドの場合は縮小アニメーションも適用する
function updateTiles() {
  // クアッドモード用の処理
  // 【修正後】updateTiles関数内のクアッドモード処理部分
  if (isQuadMode) {
    for (let b = 0; b < 4; b++) {
      if (quadSolved[b]) continue; 
      const board = document.getElementById(`board-${b}`);
      if (!board) continue;
      
      // カウンター等を除外して「駅名の行」だけを正確に取得
      const rows = Array.from(board.children).filter(r => r.classList.contains("board-row"));
      
      // 【修正3】各行の縮小・展開状態をリアルタイムに同期させる処理
      rows.forEach((r, idx) => {
        if (idx === guessesSubmitted) {
          // 現在入力中のアクティブな行は、一括展開のON/OFFに関わらず常に拡大（ライトアップ）状態をキープ
          r.classList.remove("inactive-row");
          r.classList.add("force-expand");
        } else if (idx < guessesSubmitted) {
          // 過去の回答行の処理
          r.classList.add("inactive-row");
          //if (isQuadExpanded) {
          //  r.classList.add("force-expand"); // 一括展開ONなら過去の行もすべて広げる
          //} else {
          //  r.classList.remove("force-expand"); // 一括展開OFFなら過去の行はペチャンコに縮める
          //}
        }
      });

      // 入力中の文字をタイルに反映
      const currentRow = rows[guessesSubmitted];
      if (currentRow) {
        for (let j = 0; j < rowLength; j++) {
          currentRow.children[j].textContent = currentGuess[j] || "";
        }
      }
    }
    return;
  }

  // 通常モード用の処理
  for(let j = 0; j < rowLength; j++){
    const tile = document.getElementById(`row-${guessesSubmitted}-tile-${j}`);
    if(tile) tile.textContent = currentGuess[j] || "";
  }
}


// ==========================================
// 文字の色判定処理
// ==========================================
//入力された駅名と正解の駅名を比較し、どのマスが「緑・黄・紫・黒」になるかを詳しく計算する
function evaluateGuess(guess,target, preSplitGuess = null){
let results=new Array(rowLength).fill("absent");
let targetArr=target.split(""); 
let guessArr = preSplitGuess || guess.split("");      // 分割済みの配列が渡されていればそれを使い、なければ分割する
let targetCounts={};
for(let c of targetArr)targetCounts[c]=(targetCounts[c]||0)+1;
//【ステップ1】場所も文字もぴったり合っているマスを「correct（緑）」にする
for(let i=0;i<rowLength;i++){
if(guessArr[i]===targetArr[i]){ results[i]="correct"; targetCounts[guessArr[i]]--; }
}
//【ステップ2】場所は違うけれど、その文字が駅名の別の場所に含まれていれば「present（黄）」にする
for(let i=0;i<rowLength;i++){
if(results[i]==="correct")continue;
let c=guessArr[i];
if(targetCounts[c]>0){ results[i]="present"; targetCounts[c]--; }
}
// 【ステップ3】文字自体は違うが、濁点違い・小文字違い（例：「か」に対して「が」など）があれば「diacritic（紫）」にする
let baseTargetCounts={};
for(let char in targetCounts){
if(targetCounts[char]>0){ let bc=getBaseChar(char); baseTargetCounts[bc]=(baseTargetCounts[bc]||0)+targetCounts[char]; }
}
for(let i=0;i<rowLength;i++){
if(results[i]!=="absent")continue;
let bg=getBaseChar(guessArr[i]);
if(baseTargetCounts[bg]>0){ results[i]="diacritic"; baseTargetCounts[bg]--; }
}
//すべての判定が終わったら、各マスの色のリストを返す
return results;
}


//==========================================
//図鑑データを更新・保存するための専用の処理
//==========================================
//駅の読みがなと状態（1=遭遇、2=的中）を受け取ってパソコンに記録する
function updateZukan(yomi, status){
  const savedZukan=localStorage.getItem("ekiZukanData");
  let zukan=savedZukan?JSON.parse(savedZukan):{};
  // let todayStr=new Date().toISOString().split('T')[0];
  // 【修正後】端末のローカル時計で「YYYY-MM-DD」を作成する
  let todayStr = getJSTDateString();
  
  let currentStatus=zukan[yomi]?zukan[yomi].status:0;
  //以前より良い状態（未発見→遭遇、遭遇→的中）になった場合のみ上書き保存する
  if(status>currentStatus){
    zukan[yomi]={status:status, date:todayStr};
    localStorage.setItem("ekiZukanData",JSON.stringify(zukan));
  }
}


// ==========================================
// 9. 回答を送信したときの処理とゲームの勝敗判定
// ==========================================
// プレイヤーが「回答」ボタンを押したときに、実際の答え合わせと画面への色付けを行う
// 回答を送信したときの処理とゲームの勝敗判定
function submitGuess(isRestore=false){
  // 【修正前】const isValid=stations.filter(s=>s.yomi.length===currentMode).some(s=>s.yomi===currentGuess);
  // 【修正後】無駄なリスト作りをやめ、見つかった瞬間に検索を終えるスマートな書き方に変更します
  // 【修正】廃止から40日間の「入力猶予期間（グレースピリオド）」を設ける
  const isValid = stations.some(s => 
    s.yomi === currentGuess && 
    s.yomi.length === currentMode && 
    (s.startDay === undefined || s.startDay <= currentDayIndex) && 
    // 【ここがポイント】今日から32日引いた日よりも「後」に廃止された駅なら入力を許す（=過去32日以内に廃止された駅は入力を受け付ける）
    (s.endDay === undefined || s.endDay > (currentDayIndex - 32) || s.endDay === 999999)
  );
  if(!isValid){ if(!isRestore)showMessage("実在しない駅名です"); return; }
  
  // ランダムモード（周年モード）でもハードモードの縛りを適用する。
  // ただし、エイプリルフールモード時は強制的に縛りを無効化する。
  if (!isRestore && ekiSettings.hardMode) {
    if (typeof isAprilFoolMode !== "undefined" && isAprilFoolMode) {
      // エイプリルフールモードは例外としてスルーする
    } else {
      if (!validateHardMode(currentGuess)) return;
    }
  }
  
  let stateKey = isPlayingRandom ? "random" : currentMode;
  let st = savedState[stateKey];
  if(!st) {
    st = {guesses: [], guessTimes: [], startTime: null, endTime: null, usedHint: false, isWin: false, isOver: false};
    savedState[stateKey] = st;
  }

  //古いセーブデータが原因のエラー（クラッシュ）を完全に防ぐ安全装置
  if (!st.guessTimes) st.guessTimes = [];
  if (!st.guesses) st.guesses = [];

  
  
  if(!isRestore){ 
    // 1手目を送信した時点で、このゲームをハードモードとして集計するかを確定する
    if (st.guesses.length === 0) {
      st.isHardMode = ekiSettings.hardMode;

      // 1手目を送信した瞬間にスイッチを操作不可にする
      // const hardSwitch = document.getElementById("hardmode-switch");
      // if (hardSwitch) hardSwitch.disabled = true;
    }

    // 回答を配列に保存する
    st.guesses.push(currentGuess); 
    st.guessTimes.push(Date.now());
    
    // 通常モードのみ履歴保存や図鑑更新を行う
    if(!isPlayingRandom){
      saveGameState(); 

      // ekiZukanDataに統合するため廃止
      // let allGuessed=JSON.parse(localStorage.getItem("ekiAllGuesses")||"[]");
      // if(!allGuessed.includes(currentGuess)){
      //   allGuessed.push(currentGuess);
      //   localStorage.setItem("ekiAllGuesses",JSON.stringify(allGuessed));
      // }
      
      // 【安全性強化】図鑑機能が実装されている場合のみ呼び出し、エラーを防ぐ
      if(typeof updateZukan === "function") updateZukan(currentGuess, 2);
    }
  }
  
  const resultColors=evaluateGuess(currentGuess,todayStation.yomi);
  gridHistory.push(resultColors);
  
  for(let j=0;j<rowLength;j++){
    const tile=document.getElementById(`row-${guessesSubmitted}-tile-${j}`);
    tile.textContent=currentGuess[j];
    tile.classList.add(resultColors[j]);
    const char=currentGuess[j]; const color=resultColors[j];
    updateKeyColor(char,color);
    if(color==="absent"){
      let base=getBaseChar(char);
      let targetBaseChars=todayStation.yomi.split("").map(getBaseChar);
      if(!targetBaseChars.includes(base)){
        let variants=Object.keys(baseMap).filter(k=>baseMap[k]===base);
        variants.push(base); variants.forEach(v=>updateKeyColor(v,"absent"));
      }
    }
  }
  
  filterAvailableStations(currentGuess,resultColors,isRestore);
  
  if(currentGuess===todayStation.yomi){
    let actualGuesses=guessesSubmitted+1;
    guessesSubmitted=maxGuesses;
    if(!isRestore){ 
      st.endTime=Date.now();
      st.isOver=true; st.isWin=true; 
      saveStats(true,actualGuesses); 
      
      if(!isPlayingRandom){
        // 【安全性強化】未実装機能の呼び出しによるクラッシュを完全に防ぐ
        if(typeof updateZukan === "function") updateZukan(todayStation.yomi, 3);
        saveGameState(); 
        if(typeof incrementClearAchievements === "function") incrementClearAchievements(actualGuesses, (st.endTime - st.startTime));
      }
      
      // 正解演出と結果ウィンドウの表示（クラッシュが直ったため、正常に表示されます）
      let winHtml=`<div style="font-size:24px; font-weight:bold; color:#fff; letter-spacing:2px;">正解！🎉</div>`;
      showMessage(winHtml,"#ff9800","none","0 4px 10px rgba(0,0,0,0.3)");
      setTimeout(()=>{ showResultModal(true,false); },2000);
    }
    return;
  }
  
  guessesSubmitted++;
  if(!isRestore) currentGuess="";
  
  if(guessesSubmitted===maxGuesses){
    if(!isRestore){
      st.endTime=Date.now();
      st.isOver=true; st.isWin=false; 
      saveStats(false,0); 
      
      if(!isPlayingRandom){
        if(typeof updateZukan === "function") updateZukan(todayStation.yomi, 1);
        saveGameState(); 
      }
      setTimeout(()=>showResultModal(false,false),1000);
    }
  }
}

//キーボードのボタンの色を、より優先度の高い色（黒＜紫＜黄＜緑）へ上書き更新する処理
function updateKeyColor(char,newColor){
let currColor=keyColors[char];
let currPri=currColor?colorPriority[currColor]:0;
let newPri=colorPriority[newColor];
if(newPri>currPri){
keyColors[char]=newColor;
let keyBtn=document.getElementById("key-"+char);
if(keyBtn){ keyBtn.classList.remove("correct","present","diacritic","absent"); keyBtn.classList.add(newColor); }
}
}
//今回のヒント（色の結果）を元に、全国の駅名リストをシミュレーションして残り候補駅数を計算・表示
function filterAvailableStations(guess,actualColors,isRestore){
  // 【追加】画面の切り替え（復元）処理のときは、無駄な絞り込み計算をスキップして動作を軽くする
  if(isRestore || guess === todayStation.yomi){
    return;
  }

  // 【ここに追加】ループに入る「前」に、1回だけ配列に分割しておく
  const guessArr = guess.split("");
  availableStations = availableStations.filter(s => {
    // 【変更】第3引数として分割済みの配列を渡す
    let simColors = evaluateGuess(guess, s.yomi, guessArr);
    for(let i=0; i<rowLength; i++){ if(simColors[i] !== actualColors[i]) return false; }
    return true;
  });
  
  if(guess!==todayStation.yomi && !isRestore){
    let count=availableStations.length;
    let htmlMsg=`<div style="display:flex; justify-content:center; align-items:center; font-weight:bold; color:#333;">
      <div style="width:110px; height:110px; border-radius:50%; background-color:#fff; border:4px solid #6aaa64; display:flex; flex-direction:column; justify-content:center; align-items:center; box-shadow:0 4px 10px rgba(0,0,0,0.3);">
      <div style="font-size:11px; letter-spacing:1px;">残り候補</div>
      <div style="color:#e53935; font-size:32px; font-weight:900; line-height:1.2;">${count}</div>
      <div style="font-size:11px; letter-spacing:1px;">駅</div>
      </div>
      </div>`;
    showMessage(htmlMsg,"transparent","none","none");
  }
}


// ==========================================
//ハードモード処理
// ==========================================
// ハードモードのヒント縛りルールに違反していないか検証する関数
function validateHardMode(guess) {
  // まだ1手も送信していない（履歴がない）場合はチェック不要
  if (gridHistory.length === 0) return true;
  
  // 前回の回答文字列と、それぞれのマスの色情報を取得
  const key = isPlayingRandom ? "random" : currentMode;
  const lastGuess = savedState[key].guesses[gridHistory.length - 1];
  const lastColors = gridHistory[gridHistory.length - 1];
  
  // 1. 緑色（位置も文字も一致）の縛りチェック
  for (let i = 0; i < rowLength; i++) {
    if (lastColors[i] === "correct" && guess[i] !== lastGuess[i]) {
      showMessage(`${i + 1}文字目は「${lastGuess[i]}」にしてください`);
      return false;
    }
  }
  
  // 2. 黄色（文字が含まれる）の縛りチェック
  let requiredChars = [];
  for (let i = 0; i < rowLength; i++) {
    if (lastColors[i] === "present") requiredChars.push(lastGuess[i]);
  }
  let guessArr = guess.split("");
  for (let rc of requiredChars) {
    let idx = guessArr.indexOf(rc);
    if (idx === -1) {
      showMessage(`「${rc}」を必ず含めてください`);
      return false;
    }
    guessArr.splice(idx, 1); // 複数回の重複要求を正しく判定するため、見つかった文字を消費する
  }
  
  // 3. 紫色（濁点違い・小文字違いの同じ文字グループが含まれる）の縛りチェック
  let requiredBases = [];
  for (let i = 0; i < rowLength; i++) {
    if (lastColors[i] === "diacritic") requiredBases.push(getBaseChar(lastGuess[i]));
  }
  let guessBases = guess.split("").map(getBaseChar);
  for (let rb of requiredBases) {
    let idx = guessBases.indexOf(rb);
    if (idx === -1) {
      showMessage(`「${rb}」グループの文字（濁音など）を含めてください`);
      return false;
    }
    guessBases.splice(idx, 1);
  }
  
  return true; // すべての縛りをクリアしていれば送信許可
}

// 説明欄の表示内容を現在のモードに合わせて切り替える関数
function updateHelpContent() {
  const normalContent = document.getElementById("help-normal-content");
  const hardContent = document.getElementById("help-hard-content");
  if (ekiSettings.hardMode) {
    if(normalContent) normalContent.classList.add("hidden");
    if(hardContent) hardContent.classList.remove("hidden");
  } else {
    if(normalContent) normalContent.classList.remove("hidden");
    if(hardContent) hardContent.classList.add("hidden");
  }
}


// ==========================================
// メッセージ表示と結果ウィンドウ
// ==========================================

//画面の中央に「〇〇文字入力してください」などの案内ポップアップを一時的に出す
function showMessage(text, bg="rgba(0,0,0,0.85)", border="1px solid rgba(255,255,255,0.2)", shadow="0 8px 16px rgba(0,0,0,0.3)"){
const box=document.getElementById("message-box");
box.innerHTML=text;
box.style.background=bg;
box.style.border=border;
box.style.boxShadow=shadow;
box.classList.remove("hidden");
clearTimeout(msgTimeout); msgTimeout=setTimeout(()=>box.classList.add("hidden"),2000);
}

//ゲーム終了時に、正解の駅名、Wikipediaへのリンク、旅行サイトへの広告、過去の戦績グラフをまとめて表示する大きな画面を作る
function showResultModal(isWin,isRestore){
  // 難易度ごとに戦績グラフや勝率を別々に集計・表示するための切り替え
  let stateKey = isPlayingRandom ? "random" : currentMode;
  let currentState = savedState[stateKey];
  
  // ここでも、ハードモードなら専用の箱からデータを読み込むようにする
  let targetMode = stateKey;
  if (!isPlayingRandom && currentState && currentState.isHardMode) {
    targetMode = currentMode + "_hard";
  }
  
  let st = userStats[targetMode];
  if(!st) st = {played:0,won:0,currentStreak:0,maxStreak:0,dist:[0,0,0,0,0,0,0,0,0,0]};
  if(!st.dist) st.dist=[0,0,0,0,0,0,0,0,0,0];

  document.getElementById("modal-title").textContent=isWin?"正解！おめでとう！":"残念！ゲームオーバー";
  document.getElementById("modal-desc").innerHTML = `
    <span style="font-size:18px; font-weight:bold;">${todayStation.kanji}</span><br>
    <span style="font-size:14px; color:#7f8c8d;">(${todayStation.yomi})</span><br>
  `;

  // 【修正】お取り寄せ・ふるさと納税用に、常に市区町村単位の正確な地域名を作成
  let safePref = todayStation.pref || "富山県";
  let searchMuni = todayStation.municipality || "富山市";
  let searchWard = todayStation.ward || "";
  let muniMuni = searchMuni // + searchWard; // 例：「島根県江津市」

  // トラベル用の都会・田舎のキーワード分岐（宿泊施設の件数0を回避するためトラベル側のみ維持）
  let isRural = todayStation.population < 0; // todayStation.muni_type === "町" || todayStation.muni_type === "村" || ※廃止済み条件分岐
  let areaKeyword = isRural ? safePref : muniMuni;
  let searchKw = typeof isAprilFoolMode!=="undefined"&&isAprilFoolMode ? safePref : areaKeyword;
  
  // ポップアップ内のPR用バナー文言（トラベル用に修正）
  let prText = typeof isAprilFoolMode!=="undefined"&&isAprilFoolMode 
    ? `＼ 聖地のある「${safePref}」へ巡礼して指の疲れを癒やす ／` 
    : `＼ この駅のある「${isRural ? safePref : safePref + muniMuni}」へ聖地巡礼に行こう！ ／`;

  // 【修正後】消えていた勝率計算と画面への代入処理を復元します
  // 1. プレイ回数から勝率（％）を計算します（0回の場合は0％にします）
  let winRate = st.played > 0 ? Math.round((st.won / st.played) * 100) : 0;

  // 2. 結果画面（モーダル）のそれぞれの数字が表示される場所に、最新の記録を代入します
  document.getElementById("stat-played").textContent = st.played;      // プレイ回数
  document.getElementById("stat-winrate").textContent = winRate;        // 勝率
  document.getElementById("stat-streak").textContent = st.currentStreak;  // 現在の連勝数
  document.getElementById("stat-maxstreak").textContent = st.maxStreak;  // 最大の連勝数

  // 【修正】共通関数を呼んでアフィリエイト広告を生成
  const isAF = typeof isAprilFoolMode !== "undefined" && isAprilFoolMode;
  document.getElementById("wiki-link-container").innerHTML = generateSharedAffiliateHTML(todayStation, isAF);

  // 【修正】共通関数を呼んで棒グラフを生成
  const currentClearTurn = isWin ? gridHistory.length : -1;
  document.getElementById("guess-distribution").innerHTML = generateSharedStatsGraphHTML(st.dist, currentClearTurn, maxGuesses);

  // --- (後半の絵文字作成などの処理はそのまま残す) ---
  // document.getElementById("guess-distribution").innerHTML=distHTML;
  //タイルの色の結果を四角い絵文字（🟩🟨🟪⬛）の並びに変換し、結果画面の中央に配置する
  const grid=document.getElementById("modal-grid");
  let gridHTML=gridHistory.map((row,i)=>{
  let r=row.map(c=>colorToEmoji[c]).join("");
  return r;
  }).join("<br>");
  grid.innerHTML=gridHTML;
  // ランダムモード中は、日々の勝率や戦績グラフなどの要素を非表示にしてスッキリさせる
  // 結果画面のhiddenクラスを消して、画面中央に表示させます
  const resModal = document.getElementById("result-modal");
  resModal.style.display = ""; // 古い透明化の呪縛を強制解除
  resModal.classList.remove("hidden");
}

// 結果画面でシェアボタンが押されたとき、文字と絵文字のパズル結果を組み立てて各SNSの投稿画面を開く
function shareResult(type){
  let lastColors=gridHistory.length>0?gridHistory[gridHistory.length-1]:[];
  let isWin=lastColors.length>0&&lastColors.every(c=>c==="correct");
  let scoreStr=isWin?`${gridHistory.length}/${maxGuesses}`:`X/${maxGuesses}`;
  let currentUrl=window.location.href.split('?')[0];

  // ハードモードONのときはタイトルを「駅ドルHard」に変更する
  let currentState = savedState[isPlayingRandom ? "random" : currentMode];
  let isHard = !!currentState.isHardMode;
  let gameTitle = ekiSettings.hardMode ? "駅ドルHard" : "駅ドル";
  let text=`${gameTitle} ${currentMode}文字モード ${scoreStr}\n\n`;

  text+=gridHistory.map((row,i)=>{
    let r=row.map(c=>colorToEmoji[c]).join("");
    return (isWin&&i===gridHistory.length-1)?r+"💮":r;
  }).join("\n");

  // ハードモードONのときは専用のハッシュタグ（#駅ドルHard と #駅ドルHard[文字数]）を追加する
  let hashtagStr = `#駅ドル\n`;
  if (ekiSettings.hardMode) {
    hashtagStr += `#駅ドルHard\n`;
  }
  hashtagStr += `#駅ドル${currentMode}\n`;
  if (ekiSettings.hardMode) {
    hashtagStr += `#駅ドルHard${currentMode}\n`;
  }

  text += `\n\n${hashtagStr}`;

  // 【修正】実際のシェア送信処理を共通関数に任せる
  executeSharedShare(type, text, currentUrl);
}

// すべての画面準備が整った（DOM構築完了）タイミングで一番最初の初期化関数（initGame）を起動させます
window.addEventListener("DOMContentLoaded",initGame);


//11.行事日エフェクト
window.triggerEventEffect=(ev)=>{
  document.body.className=document.body.className.replace(/event-\w+/g,"");
  let c=document.getElementById("event-container");
  if(c)c.remove();
  const oldHm = document.getElementById("site-anni-headmark");
  if(oldHm) oldHm.remove();

  if(!ev)return;
  document.body.classList.add("event-"+ev);

  //サイト周年記念（ロゴの特別装飾と感謝メッセージ）
  if(ev === "site_anniversary"){
    let nYear = sessionStorage.getItem("debug_site_anni_year") || 1; 
    const h1 = document.querySelector('h1');
    if(h1){
      const headmark = document.createElement("div");
      headmark.id = "site-anni-headmark";
      headmark.style.marginLeft = "10px";
      headmark.style.transform = "rotate(10deg)"; 
      headmark.innerHTML = `<svg width="45" height="45" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#ffd700" stroke="#ff8c00" stroke-width="4"/><circle cx="50" cy="50" r="38" fill="#fff"/><text x="50" y="42" font-family="sans-serif" font-size="18" font-weight="bold" fill="#d32f2f" text-anchor="middle">祝</text><text x="50" y="70" font-family="sans-serif" font-size="22" font-weight="bold" fill="#d32f2f" text-anchor="middle">${nYear}周年</text><path d="M 20 85 L 10 110 L 35 95 Z" fill="#ff8c00"/><path d="M 80 85 L 90 110 L 65 95 Z" fill="#ff8c00"/></svg>`;
      h1.appendChild(headmark);
    }
    
    // 【優先度10】サイト周年ポップアップを順番待ち列に登録
    registerEventPopup(10, () => {
      const siteAnniDiv = document.createElement("div");
      siteAnniDiv.style.position = "fixed"; siteAnniDiv.style.top = "50%"; siteAnniDiv.style.left = "50%"; siteAnniDiv.style.transform = "translate(-50%,-50%)";
      siteAnniDiv.style.background = "#fff"; siteAnniDiv.style.border = "4px solid #ffd700"; siteAnniDiv.style.padding = "25px"; siteAnniDiv.style.zIndex = "10000";
      siteAnniDiv.style.borderRadius = "12px"; siteAnniDiv.style.textAlign = "center"; siteAnniDiv.style.color = "#333"; siteAnniDiv.style.boxShadow = "0 4px 15px rgba(0,0,0,0.3)";
      siteAnniDiv.style.width = "85%"; siteAnniDiv.style.maxWidth = "350px";
      siteAnniDiv.innerHTML = "<h2 style='color:#d32f2f;margin-top:0;'>🎉 駅ドル "+nYear+"周年記念！ 🎉</h2><p style='font-size:14px;line-height:1.6;'>皆様にご乗車いただき、駅ドルは無事に "+nYear+" 周年を迎えることができました。</p><p style='font-size:14px;line-height:1.6;'>日頃の感謝を込めて、本日は特別なお祭り仕様で運行中です。<br>これからも末永いご愛顧をよろしくお願いいたします！</p><button id='close-site-anni-btn' class='btn' style='background:#d32f2f;color:#fff;margin-top:15px;font-size:16px;'>出発進行！</button>";
      document.body.appendChild(siteAnniDiv);
      siteAnniDiv.querySelector('button').addEventListener('click', () => {
      siteAnniDiv.remove();
      showNextEventPopup(); // 閉じた後に次のポップアップを呼ぶ
    });
    });
  }

  //エイプリルフール限定モード
  if(ev==="aprilfool"){
    let mLen=stations.reduce((max,s)=>Math.max(max,s.yomi.length),0);
    let longestPool=stations.filter(s=>s.yomi.length===mLen);
    
    // 【修正後】以下のコードにまるごと差し替えてください
    let afSaved = localStorage.getItem("ekiAF_" + currentDayIndex);
    let longestSt;
    if (afSaved) { 
      longestSt = JSON.parse(afSaved); 
    } else { 
      // 【追加】今日以外の古い「ekiAF_〇〇」データを綺麗にお掃除する
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith("ekiAF_")) localStorage.removeItem(k);
      });
      // 新しい駅を選んで保存
      longestSt = longestPool[Math.floor(Math.random() * longestPool.length)]; 
      localStorage.setItem("ekiAF_" + currentDayIndex, JSON.stringify(longestSt)); 
    }
    
    const modeArea=document.querySelector(".mode-btn").parentNode;
    if(modeArea&&!document.getElementById("mode-"+mLen)){
      const bMax=document.createElement("button");
      bMax.id="mode-"+mLen;bMax.className="mode-btn btn";bMax.innerText=mLen+"文字";
      bMax.style.backgroundColor="#e91e63";bMax.style.color="#fff";bMax.style.border="none";
      
      bMax.addEventListener("click",()=>{
        // 【追加】エイプリルフールモードではハードモードスイッチを強制OFFにし、操作不可（グレーアウト）にする
        const hs = document.getElementById("hardmode-switch");
        if(hs) {
          hs.checked = false;
          hs.disabled = true;
        }
        ekiSettings.hardMode = false;
        
      if(typeof updateHelpContent === "function") updateHelpContent();

    document.querySelectorAll(".mode-btn").forEach(b=>b.classList.remove("active"));
    bMax.classList.add("active"); 
    isAprilFoolMode=true; 
    isPlayingRandom=false;
        currentMode=mLen; rowLength=mLen; maxGuesses=4;
        
        const gb=document.getElementById("game-board"); gb.style.setProperty("--row-length",mLen);
        const afs=document.createElement("style"); afs.id="af-style";
        afs.innerHTML=".event-aprilfool #game-board{display:block!important;width:100%!important;max-width:100vw!important;overflow-x:auto!important;padding-bottom:20px!important;box-sizing:border-box!important;}.event-aprilfool .board-row{display:grid!important;grid-template-columns:repeat("+mLen+",60px)!important;gap:5px!important;margin-bottom:5px!important;width:max-content!important;margin-left:auto!important;margin-right:auto!important;padding:0 10px!important;}.event-aprilfool .tile{width:60px!important;height:60px!important;font-size:24px!important;}";
        document.head.appendChild(afs);

        //エイプリルフール限定モードのデータ初期化
        if(!userStats[mLen])userStats[mLen]={played:0,won:0,currentStreak:0,maxStreak:0,dist:[0,0,0,0,0,0,0,0,0,0]};
        if(!savedState[mLen]) {
          savedState[mLen]={guesses:[], guessTimes:[], startTime:null, endTime:null, usedHint:false, isOver:false, isWin:false};
        } else {
          if(!savedState[mLen].guessTimes) savedState[mLen].guessTimes = [];
        }
        
        todayStation=longestSt; restoreBoard();
      });
      
      modeArea.appendChild(bMax);
      document.querySelectorAll(".mode-btn:not(#mode-"+mLen+")").forEach(b=>{
        b.addEventListener("click",()=>{ isAprilFoolMode=false; const old=document.getElementById("af-style"); if(old)old.remove(); });
      });

      // 【優先度20】エイプリルフールのポップアップを順番待ち列に登録
      registerEventPopup(20, () => {
        const div=document.createElement("div");
        div.style.position="fixed";div.style.top="50%";div.style.left="50%";div.style.transform="translate(-50%,-50%)";
        div.style.background="#fff";div.style.border="4px solid #e91e63";div.style.padding="25px";div.style.zIndex="10000";
        div.style.borderRadius="12px";div.style.textAlign="center";div.style.color="#333";div.style.boxShadow="0 4px 15px rgba(0,0,0,0.3)";
        div.style.width="85%";div.style.maxWidth="400px";
        div.innerHTML="<h2 style='color:#e91e63;margin-top:0;'>駅ドルへようこそ！</h2><p style='font-size:16px;line-height:1.6;'>本日はエイプリルフール。</p><p style='font-size:16px;line-height:1.6;'>日本一長い駅名（"+mLen+"文字）を当てる<br><b>超・鬼畜モード</b>が解禁されました！</p><p style='font-size:14px;color:#555;'>画面上の「"+mLen+"文字」ボタンから挑戦できます。<br>横にスクロールして全文字を入力してください。<br>（※回答回数は特別に <b>4回</b> です）</p><button id='close-af-btn' class='btn' style='background:#e91e63;color:#fff;margin-top:15px;font-size:18px;'>挑戦する</button>";
        document.body.appendChild(div);
        // エイプリルフールポップアップの中にあるボタンを確実に指定する
        div.querySelector('button').addEventListener('click', () => {
          div.remove();
          showNextEventPopup(); // 閉じた後に次のポップアップを呼ぶ
        });
      });
    }
  }

  if(["newyear","hinamatsuri","kodomo","tanabata","nye","anniversary","site_anniversary","christmas","valentine","halloween","railway"].includes(ev)){
    c=document.createElement("div");c.id="event-container";
    // エフェクトの枠が画面を覆ってクリックを邪魔しないようにする設定
    c.style.position="fixed";c.style.top="0";c.style.left="0";c.style.width="100vw";c.style.height="100vh";
    c.style.pointerEvents="none"; // ★これが「見えない壁」をすり抜ける魔法のコードです
    c.style.zIndex="99999";
    document.body.appendChild(c);
    let char=Math.random()>0.5?"❄️":"🎄";
    if(ev==="hinamatsuri"||ev==="anniversary"||ev==="site_anniversary")char="🌸";
    if(ev==="newyear")char="🎍";if(ev==="kodomo")char="🎏";if(ev==="tanabata")char="🎋";if(ev==="nye")char="🔔";
    if(ev==="valentine")char=Math.random()>0.5?"💖":"🍫";if(ev==="halloween")char=Math.random()>0.5?"🎃":"🦇";if(ev==="railway")char=Math.random()>0.5?"🚄":"🚃";
    for(let i=0;i<30;i++){
      let p=document.createElement("div");p.className="particle";p.innerText=char;
      p.style.left=Math.random()*100+"vw";p.style.animationDuration=(Math.random()*4+3)+"s";
      p.style.fontSize=(Math.random()*15+15)+"px";p.style.opacity=Math.random()*0.5+0.5;c.appendChild(p);
    }
    setTimeout(()=>{if(c)c.remove();},8000);
  }

  // すべてのイベント判定が終わった最後に、順番待ち列を一斉スタートさせる
  setTimeout(startEventPopups, 100);
};

//現在の日付を取得して、今日が何か特別な「行事日」に該当するかどうかを毎日チェックする
const checkSpecialEvent=()=>{
const d=new Date();const m=d.getMonth()+1;const day=d.getDate();
let ev="";
if(m===1&&day<=3)ev="newyear";
else if(m===2&&day===14)ev="valentine";
else if(m===3&&day===3)ev="hinamatsuri";
else if(m===4&&day===1)ev="aprilfool";
else if(m===5&&day===5)ev="kodomo";
else if(m===7&&day===7)ev="tanabata";
else if(m===10&&day===14)ev="railway";
else if(m===10&&day===31)ev="halloween";
else if(m===12&&(day===24||day===25))ev="christmas";
else if(m===12&&day===31)ev="nye";

// サイト周年の自動判定
const openDate = new Date(SITE_OPEN_DATE);
if (m === openDate.getMonth() + 1 && day === openDate.getDate() && d.getFullYear() > openDate.getFullYear()) {
  ev = "site_anniversary";
  let nYear = d.getFullYear() - openDate.getFullYear();
  sessionStorage.setItem("debug_site_anni_year", nYear);
}
// ユーザー個人の周年記念判定
const meta = JSON.parse(localStorage.getItem("ekiZukanMeta") || '{}');
if (meta.firstPlayDate) {
  const firstDate = new Date(meta.firstPlayDate);
  if (firstDate.getMonth() + 1 === m && firstDate.getDate() === day && firstDate.getFullYear() < d.getFullYear()) {
    const years = d.getFullYear() - firstDate.getFullYear();
    const modeArea = document.querySelector(".mode-btn").parentNode;
    if (modeArea && !document.getElementById("mode-anniversary")) {
      const btnAnni = document.createElement("button");
      btnAnni.id = "mode-anniversary";
      btnAnni.className = "mode-btn btn";
      btnAnni.innerText = "🎫 " + years + "周年特別きっぷ";
      btnAnni.style.backgroundColor = "#ffd700";
      btnAnni.style.color = "#333";
      btnAnni.style.fontWeight = "900";
      btnAnni.style.border = "2px solid #ff8c00";
      
      // 記念ボタンが押されたときの特別な動作
      // 記念ボタンが押されたときの特別な動作
      btnAnni.addEventListener("click", () => {
        // ランダムモードをONにする
        isPlayingRandom = true; 
        isAprilFoolMode = false; // 【追加】念のためエイプリルフールフラグを解除する
        
        // 【追加】ハードモードスイッチの操作不可（グレーアウト）状態を解除する
        const hs = document.getElementById("hardmode-switch");
        if(hs) hs.disabled = false;

        document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
        
        btnAnni.classList.add("active");
        
        // 5文字の駅リストを取得し、候補駅（残り駅数）を正しくリセットする
        const modeStations = stations.filter(s => s.yomi.length === 5);
        availableStations = [...modeStations]; // ←【修正】ここで残り駅のリストをリセットします
        
        todayStation = modeStations[Math.floor(Math.random() * modeStations.length)];
        currentMode = 5; rowLength = 5; maxGuesses = 6;
        document.getElementById("game-board").style.setProperty("--row-length", 5);
        
        // ランダム専用の枠を初期化し、画面をまっさらにする
        savedState["random"] = {guesses: [], guessTimes: [], startTime: null, endTime: null, usedHint: false, isWin: false, isOver: false};
        currentGuess = ""; guessesSubmitted = 0; gridHistory = []; keyColors = {};
        
        // 残り駅数の表示要素があれば、初期状態の件数に書き換える
        const remainEl = document.getElementById("remaining-count");
        if(remainEl) remainEl.textContent = availableStations.length;
        
        drawBoard(); buildKeyboard();
        
        showMessage("特別きっぷ発券！<br>何度でもランダム出題に挑戦できます", "#ff9800", "none", "0 4px 10px rgba(0,0,0,0.3)");
      });
      modeArea.appendChild(btnAnni);

      // 【優先度30】ユーザー周年ポップアップを登録（一番最後に表示）
      registerEventPopup(30, () => {
        const userAnniDiv = document.createElement("div");
        userAnniDiv.style.position = "fixed"; userAnniDiv.style.top = "50%"; userAnniDiv.style.left = "50%"; userAnniDiv.style.transform = "translate(-50%,-50%)";
        userAnniDiv.style.background = "#fff"; userAnniDiv.style.border = "4px solid #4caf50"; userAnniDiv.style.padding = "25px"; userAnniDiv.style.zIndex = "10000";
        userAnniDiv.style.borderRadius = "12px"; userAnniDiv.style.textAlign = "center"; userAnniDiv.style.color = "#333"; userAnniDiv.style.boxShadow = "0 4px 15px rgba(0,0,0,0.3)";
        userAnniDiv.style.width = "85%"; userAnniDiv.style.maxWidth = "350px";
        userAnniDiv.innerHTML="<h2 style='color:#4caf50;margin-top:0;'>🎉 ご乗車 "+years+" 周年！ 🎉</h2><p style='font-size:14px;line-height:1.6;'>今日で「駅ドル」の運行に加わっていただいてから、ちょうど <b>"+years+" 年</b> が経ちました！</p><p style='font-size:14px;line-height:1.6;'>日頃の感謝を込めまして、何度でも遊べる<b>ランダム出題モード</b>の特別きっぷを発券いたしました。<br>（画面上の金色のボタンから挑戦できます）</p><p style='font-size:12px;color:#777;'>※特別きっぷの戦績記録は、本日限定で集計されます。</p><button id='close-user-anni-btn' class='btn' style='background:#4caf50;color:#fff;margin-top:15px;font-size:16px;width:100%;'>出発進行！</button>";
        document.body.appendChild(userAnniDiv);
        // ユーザー周年ポップアップの中にあるボタンを確実に指定する
        userAnniDiv.querySelector('button').addEventListener('click', () => {
          userAnniDiv.remove();
          showNextEventPopup(); // ★閉じた後に次を呼ぶ
        });
      });
    }
    // ユーザー記念日用の紙吹雪をセット
    if(ev === "") ev = "anniversary";
  }
}
window.triggerEventEffect(ev);
//キューに溜まったポップアップの表示をスタートする！
// triggerEventEffect内で setTimeout(startEventPopups, 100); が実行されるため、
// ここで直接 showNextEventPopup() を呼ぶのはやめて startEventPopups() に直します。
startEventPopups(); 
};


// ==========================================
// 実績カウンター
// ==========================================

// プレイヤーが正解（クリア）した瞬間に、すべての実績データを一斉に計算して更新する関数
function incrementClearAchievements(actualGuesses, clearTimeMs) {
  // 保存されている実績データを読み込み、無ければ初期構造を作ります
  let ach = JSON.parse(localStorage.getItem("ekiAchievements") || '{"bestScores":{},"counters":{"legendStationClears":0,"noAbsentClears":0,"totalYomiLength":0,"noHintClears":0,"hintUsedClears":0,"totalSubmitCount":0},"winStreak":{"currentStreak":0,"maxStreak":0,"lastClearedDate":""},"hourlyClears":{},"unlockedSets":{"prefs":[],"companies":[],"lines":[],"clearedEvents":[],"clearedMonthDays":[],"clearedStationNames":[]}}');
  
  // --- 1. 将来のモード（3文字、7文字など）に自動対応する処理 ---
  if (!ach.bestScores[currentMode]) {
    ach.bestScores[currentMode] = { "minGuesses": 8, "bestTimeMs": 9999999 };
  }
  
  // --- 2. 最小手数と最速クリアタイムの更新 ---
  if (actualGuesses < ach.bestScores[currentMode].minGuesses) {
    ach.bestScores[currentMode].minGuesses = actualGuesses;
  }
  if (clearTimeMs < ach.bestScores[currentMode].bestTimeMs) {
    ach.bestScores[currentMode].bestTimeMs = clearTimeMs;
  }
  
  // --- 3. 24時間タイマー（時間帯）の集計 ---
  // 現在の「時（0〜23）」を取得し、該当する時間帯のクリア回数を1増やします
  const now = new Date();
  const hour = String(now.getHours());
  ach.hourlyClears[hour] = (ach.hourlyClears[hour] || 0) + 1;
  
  // --- 4. カウンター系（開業年・読み仮名数・送信数・ヒント関連）の集計 ---
  // 正解した駅名の読み仮名の文字数を累計に加算します
  ach.counters.totalYomiLength += todayStation.yomi.length;
  
  // 1900年以前の明治生まれの古い駅を正解した場合
  if (parseInt(todayStation.open_year, 10) <= 1900) {
    ach.counters.legendStationClears++; 
  }
  
  // 今回のプレイで黒（灰タイル）を一度も出さずにストレートクリアした場合
  let isNoAbsent = gridHistory[gridHistory.length - 1].every(c => c !== "absent");
  if (isNoAbsent) {
    ach.counters.noAbsentClears++; 
  }
  
  // 今回のプレイでヒントを使ったかどうかを判定し、それぞれのカウンターを増やします
  if (savedState[currentMode] && savedState[currentMode].usedHint === false) {
    ach.counters.noHintClears++; // ノーヒントでクリアした回数
  } else {
    ach.counters.hintUsedClears++; // ヒントを使ってクリアした回数
  }
  
  // 累計回答送信回数に、今回のクリアまでにかかった手数を加算します
  ach.counters.totalSubmitCount += actualGuesses; 
  
  // --- 5. 通算連勝（1日3回クリアに対応する日付スタンプ判定） ---
  // 【修正】端末の現在時刻ではなく、出題された問題の「日数（currentDayIndex）」を基準に日付を計算します
  const baseDate = new Date(Date.UTC(2024, 0, 1));
  const logicalDate = new Date(baseDate.getTime() + currentDayIndex * 86400000);
  const todayStr = logicalDate.getUTCFullYear() + "-" + String(logicalDate.getUTCMonth() + 1).padStart(2, '0') + "-" + String(logicalDate.getUTCDate()).padStart(2, '0');
  
  // 最後にクリアした日が「論理的な今日」以外の場合のみ、連勝の計算を行います
  if (ach.winStreak.lastClearedDate !== todayStr) {
    // 問題ベースの「昨日」の日付を計算します
    const logicalYesterday = new Date(logicalDate.getTime() - 86400000);
    const yesterdayStr = logicalYesterday.getUTCFullYear() + "-" + String(logicalYesterday.getUTCMonth() + 1).padStart(2, '0') + "-" + String(logicalYesterday.getUTCDate()).padStart(2, '0');
    
    // 最後にクリアした日が「昨日」であれば連勝を伸ばし、それ以外なら1日にリセットします
    if (ach.winStreak.lastClearedDate === yesterdayStr) {
      ach.winStreak.currentStreak++; 
    } else {
      ach.winStreak.currentStreak = 1; 
    }
    
    // 最高連勝記録を上回った場合はデータを塗り替えます
    if (ach.winStreak.currentStreak > ach.winStreak.maxStreak) {
      ach.winStreak.maxStreak = ach.winStreak.currentStreak;
    }
    ach.winStreak.lastClearedDate = todayStr; // 最終クリア日を更新します
  }
  
  // --- 6. コレクション要素（都道府県・事業者・路線・駅名・月日）の集計 ---
  // 配列（リスト）の中にまだ存在しない場合のみ、新しく追加（push）します
  //都道府県
  //if (todayStation.pref && !ach.unlockedSets.prefs.includes(todayStation.pref)) {
  //  ach.unlockedSets.prefs.push(todayStation.pref);
  //}
  //所属事業者
  //if (todayStation.companies) {
  //  todayStation.companies.forEach(c => {
  //    if (!ach.unlockedSets.companies.includes(c)) ach.unlockedSets.companies.push(c);
  //  });
  //}
  //所属路線
  //if (todayStation.lines) {
  //  todayStation.lines.forEach(l => {
  //    if (!ach.unlockedSets.lines.includes(l)) ach.unlockedSets.lines.push(l);
  //  });
  //}
  
  if (!ach.unlockedSets.clearedStationNames.includes(todayStation.kanji)) {
    ach.unlockedSets.clearedStationNames.push(todayStation.kanji); // 駅名（新幹線全制覇などの判定用）
  }

  // 【ここから追加】
  // 現在の文字数モードのプレイ状態を取得する
  let currentState = savedState[currentMode];
  
  // 1手目から最後までハードモードを維持してクリアした場合の処理
  if (currentState && currentState.isHardMode) {
    
    // ハードでクリアした駅名を保存する配列がまだ無ければ作成する
    if (!ach.unlockedSets.hardClearedStationNames) {
      ach.unlockedSets.hardClearedStationNames = [];
    }
    
    // まだ記録されていない駅名であれば、配列の末尾に追加する
    if (!ach.unlockedSets.hardClearedStationNames.includes(todayStation.kanji)) {
      ach.unlockedSets.hardClearedStationNames.push(todayStation.kanji);
    }
    
  }
  // 【ここまで追加】
  
  // 毎月1日や周年記念などの判定用に、月日のスタンプ（例：06-05）を保存します
  // 【修正】ここでも、カレンダーの今日ではなく「問題の今日」の日付を使います
  const monthDayStr = String(logicalDate.getUTCMonth() + 1).padStart(2, '0') + "-" + String(logicalDate.getUTCDate()).padStart(2, '0');
  if (!ach.unlockedSets.clearedMonthDays.includes(monthDayStr)) {
    ach.unlockedSets.clearedMonthDays.push(monthDayStr);
  }
  
  // --- 7. 行事日イベント名の集計 ---
  // 画面のクラス名から現在のイベント名（christmasなど）を取得して保存します
  const currentEvent = document.body.className.match(/event-(\w+)/);
  if (currentEvent && currentEvent[1]) {
    const evName = currentEvent[1];
    if (!ach.unlockedSets.clearedEvents.includes(evName)) {
      ach.unlockedSets.clearedEvents.push(evName); 
    }
  }
  
  // 最後に、新しく計算し終わった実績データをLocalStorageに一括で上書き保存します
  localStorage.setItem("ekiAchievements", JSON.stringify(ach));
  
  // --- 8. クリア済みインデックスの記録（文字数モード別） ---（後から復元できるため廃止）
  // let clearedData = JSON.parse(localStorage.getItem("ekiClearedDays") || '{"4":[],"5":[],"6":[],"4_hard":[],"5_hard":[],"6_hard":[]}');
  
  // 通常モードの記録（ハードでクリアした場合も、大元の「クリア済み」として記録しておく）
  // if (!clearedData[currentMode]) clearedData[currentMode] = [];
  // if (!clearedData[currentMode].includes(currentDayIndex)) {
  //   clearedData[currentMode].push(currentDayIndex);
  //   clearedData[currentMode].sort((a, b) => a - b);
  // }

  // ハードモードの記録（ハードモード維持でクリアした場合のみ、別途 _hard 枠にも記録）
  // if (currentState && currentState.isHardMode) {
  //   let hardKey = currentMode + "_hard";
  //   if (!clearedData[hardKey]) clearedData[hardKey] = [];
  //   if (!clearedData[hardKey].includes(currentDayIndex)) {
  //     clearedData[hardKey].push(currentDayIndex);
  //     clearedData[hardKey].sort((a, b) => a - b);
  // }
  // }
  
  // localStorage.setItem("ekiClearedDays", JSON.stringify(clearedData));
}

// テーマカラー切り替え時のラグ解消
//function toggleDarkMode() {
  // 1. アニメーション無効化クラスを付ける
//  document.body.classList.add('preload-transitions');
  
  // 2. ダークモードのクラスを切り替える
//  document.body.classList.toggle('theme-dark');
  
  // 3. 【追加】ここでブラウザに現在の高さを読み取らせることで、
  // 強制的に「アニメーションなしの状態」を一度計算（確定）させます。
//  document.body.offsetHeight; 
  
  // 4. その後、無効化クラスを外す（setTimeoutは不要になります）
//  document.body.classList.remove('preload-transitions');
//}


// ==========================================
// 駅ドル・クアッド（4画面）モードの全処理システム
// ==========================================

let isQuadMode = false;              // 現在クアッドモードかどうか
let isQuadExpanded = false;          // 一括展開モードがONになっているかを記憶するフラグ
let quadStations = [];               // 4つの正解駅オブジェクトを格納する配列
let quadSolved = [false, false, false, false]; // 各盤面がクリアされたかを管理するフラグ
let quadKeyColors = {};              // キーボード用の4分割色ログ
let quadGridHistory = [];            // 【追加】各手ごとの4盤面の色結果を記憶する箱


// クアッドモードを開始する処理
async function startQuadMode() {
  isQuadMode = true;
  isPlayingRandom = false;
  quadSolved = [false, false, false, false];
  quadKeyColors = {};
  quadGridHistory = []; 
  currentGuess = "";
  guessesSubmitted = 0;

  // クアッド用の盤面コンテナを表示する
  const quadContainer = document.getElementById("quad-board-container");
  if (quadContainer) quadContainer.classList.remove("hidden");
  document.getElementById("expand-toggle-btn")?.classList.remove("hidden");

  // 通常用の盤面コンテナを非表示にする
  const normalBoard = document.getElementById("game-board");
  if (normalBoard) normalBoard.classList.add("hidden");

  // ハードモードのスイッチ領域を非表示にする（クアッドにはハードモードが存在しないため）
  const hardContainer = document.querySelector(".hardmode-container");
  if (hardContainer) hardContainer.classList.add("hidden");

  // 現在の文字数に合わせて、入力判定用の「駅リスト」を正しく更新する
  availableStations = stations.filter(s => s.yomi.length === currentMode).map(s => s.yomi);
  
  // クアッド盤面のCSS変数（列数）を更新し、見た目の枠数を合わせる
  document.getElementById("quad-board-container")?.style.setProperty("--row-length", currentMode);

  await selectQuadStations(currentMode);
  
  buildQuadBoards();
  resetKeyboardStyles();

  // クアッドモードのセーブデータ復元処理
  let stateKey = "quad" + currentMode;
  let st = savedState[stateKey];

  // 保存された展開設定があれば復元し、無ければデフォルト（false）にします
  isQuadExpanded = st && st.isExpanded ? true : false;
  
  // まだ保存枠がない場合は新しく作成する
  if (!st) {
    st = {guesses: [], guessTimes: [], quadSolved: [false,false,false,false], quadGridHistory: [], isOver: false};
    savedState[stateKey] = st;
  }
  
  // セーブデータが存在する場合は、順番に送信して画面を再現する
  if (st && st.guesses && st.guesses.length > 0) {
    st.guesses.forEach(g => {
      currentGuess = g;
      submitQuadGuess(true); // 復元モードで過去の単語を流し込む
    });
  }
  currentGuess = "";

  // ★修正：外側のカウンター要素を巻き込まないよう、正確に「board-row」だけを取得してライトアップします
  for (let b = 0; b < 4; b++) {
    const board = document.getElementById(`board-${b}`);
    if (board) {
      const rows = Array.from(board.getElementsByClassName("board-row"));
      
      // 各行（r）が現在何手目（idx）かを判定し、状態を適用する
      rows.forEach((r, idx) => {
        
        // まだクリアされていない盤面の、現在入力する行だけを確実に拡大する
        if (idx === guessesSubmitted && !quadSolved[b]) {
          r.classList.remove("inactive-row");
          r.classList.add("force-expand"); 
          
        } else {
          r.classList.add("inactive-row");
          
          // 過去の行（idx < guessesSubmitted）で、かつ展開設定（isQuadExpanded）がONなら拡大状態を維持する
          if (idx < guessesSubmitted && isQuadExpanded) {
            r.classList.add("force-expand");
          } else {
            // それ以外（未来の行や、展開設定がOFFの場合）は閉じる
            r.classList.remove("force-expand");
          }
        }
      });
    }
  }

  if (typeof updateQuadRemainingCounts === "function") {
    updateQuadRemainingCounts();
  }
}

// 4つの駅を決定する処理（ファイル参照 ＋ 失敗時はシミュレーション）
async function selectQuadStations(modeLength) {
  const SECRET_SALT = "EkiDoru_Secret_2026!";
  let todayStr = getJSTDateString();
  const yearStr = todayStr.split("-")[0];
  
  // クアッド用候補駅（通常の出題条件 ＋ 通常モードの今日の答えとは被らないようにする）
  let validPool = stations.filter(s => 
      s.yomi.length === modeLength && 
      s.pref && s.companies && s.companies.length > 0 &&
      !(s.companies.length === 1 && s.companies[0] === "日本貨物鉄道") &&
      s.is_abolished_confirmed !== true &&
      (!todayStation || s.yomi !== todayStation.yomi)
  );

  try {
    // ① まずは答えファイル（answers.json）の「quad4」などのキーから4つのハッシュを取得
    const answersData = await fetchSharedAnswerDict(yearStr);
    const targetHashes = answersData[todayStr]?.[`quad${modeLength}`];
    
    if (!targetHashes || targetHashes.length !== 4) {
        throw new Error("本日のクアッド答えデータがありません");
    }

    // 全候補駅のハッシュを計算して逆引きする
    const calcSha256 = async (str) => {
      const buf = new TextEncoder().encode(str);
      const hashBuf = await crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const hashPromises = validPool.map(async (s) => {
      return { station: s, hash: await calcSha256(SECRET_SALT + s.yomi) };
    });
    const hashedStations = await Promise.all(hashPromises);

    quadStations = [];
    for (let h of targetHashes) {
        const found = hashedStations.find(item => item.hash === h);
        if (found) quadStations.push(found.station);
        else throw new Error("ハッシュが一致する駅が見つかりません");
    }
    return; // ファイルから無事に取得できた場合はここで終了
    
  } catch (err) {
    console.warn("クアッドのファイル読み込み失敗。シミュレーションで決定します:", err);
    
    // 【修正1】通常モードの出禁辞書を読み込む（通常モードと被らないようにするため）
    const normalStateKey = `ekidle_rng_state_${currentMode}`;
    let normalSaved = JSON.parse(localStorage.getItem(normalStateKey) || "{}");
    let normalBanned = normalSaved.nextAvailableDay || {};

    // 【修正2】クアッド専用の「日付辞書（nextAvailableDay）」を新設して読み込む
    const quadStateKey = `ekidle_rng_state_quad_${currentMode}_v2`;
    let quadSaved = JSON.parse(localStorage.getItem(quadStateKey) || "{}");
    let quadNextAvailableDay = quadSaved.nextAvailableDay || {};
    let startDay = quadSaved.lastCalculatedDay !== undefined ? quadSaved.lastCalculatedDay + 1 : 0;

    let uniqueYomiCount = new Set(validPool.map(s => s.yomi)).size;
    let lookback = Math.min(1000, Math.floor(uniqueYomiCount * 0.7));

    // 【修正3】通常モードと同じく、0日目（または計算の続き）から今日までを一気にシミュレーションする
    for (let d = startDay; d <= currentDayIndex; d++) {
      
      // 現役の駅であり、通常モードでもクアッドモードでも出禁になっていない駅だけを抽出
      let pool = validPool.filter(s =>
        (s.startDay === undefined || s.startDay <= d) &&
        (s.endDay === undefined || s.endDay > d || s.endDay === 999999) &&
        !(normalBanned[s.yomi] && normalBanned[s.yomi] > d) &&
        !(quadNextAvailableDay[s.yomi] && quadNextAvailableDay[s.yomi] > d)
      );

      let seed = d * 12345 + modeLength * 6789;
      const random = () => {
        seed = Math.imul(seed ^ (seed >>> 15), 2246822507);
        seed = Math.imul(seed ^ (seed >>> 13), 3266489909);
        return ((seed ^ (seed >>> 16)) >>> 0) / 4294967296;
      };

      quadStations = [];
      for (let i = 0; i < 4; i++) {
        // 枯渇時の安全装置
        if (pool.length === 0) {
          pool = validPool.filter(s =>
            (s.startDay === undefined || s.startDay <= d) &&
            (s.endDay === undefined || s.endDay > d || s.endDay === 999999) &&
            !quadStations.map(q => q.yomi).includes(s.yomi)
          );
        }
        
        const r = Math.floor(random() * pool.length);
        const selected = pool[r];
        quadStations.push(selected);
        
        // 選ばれた駅と同音異字をこのターンのくじ引き箱からすべて捨てる
        pool = pool.filter(s => s.yomi !== selected.yomi);
        
        // クアッド専用の辞書に「次回出禁解除日」を登録
        quadNextAvailableDay[selected.yomi] = d + lookback + 1;
      }
    }
    
    // 【修正4】不要な過去の出禁データを掃除し、最新の状態だけを保存する
    let stateToSave = { lastCalculatedDay: currentDayIndex, nextAvailableDay: {} };
    for (const yomi in quadNextAvailableDay) {
      if (quadNextAvailableDay[yomi] > currentDayIndex) {
        stateToSave.nextAvailableDay[yomi] = quadNextAvailableDay[yomi];
      }
    }
    localStorage.setItem(quadStateKey, JSON.stringify(stateToSave));
  }
}


// 【修正後】行の独立トグル化およびShiftキーでの範囲一括拡大機能
function buildQuadBoards() {
  for (let b = 0; b < 4; b++) {
    const board = document.getElementById(`board-${b}`);
    board.className = "quad-board"; // クリア状態をリセット
    board.innerHTML = "";
    board.style.setProperty("--row-length", currentMode);

    // ▼▼▼ 追加：残り駅数をリアルタイム表示する要素を左上に配置 ▼▼▼
    const counter = document.createElement("div");
    counter.className = "quad-remain-counter";
    counter.id = `quad-remain-${b}`;
    counter.textContent = "残り -- 駅";
    // counter.style.display = "none"; // ★追加：1手目を打つまでは非表示
    board.appendChild(counter);
    // ▲▲▲ 追加ここまで ▲▲▲

    // この盤面（ボード）内で最後にクリックされた行の番号を記憶する変数
    let lastClickedIdx = null;

    // 【修正3】全回答行をループで生成する処理
    for (let i = 0; i < maxGuesses; i++) {
      const row = document.createElement("div");
      row.className = "board-row";
      
      // 1行目固定ではなく、現在入力待ちのアクティブな行（guessesSubmitted）を最初から拡大します
      if (i === guessesSubmitted) {
        row.classList.add("force-expand"); // 現在入力中の行は常に拡大
      } else {
        row.classList.add("inactive-row");
        // もし前回「一括展開」されていた場合は、過去の行も最初から拡大状態にします
        if (i < guessesSubmitted && isQuadExpanded) {
          row.classList.add("force-expand");
        }
      }
      
      for (let j = 0; j < currentMode; j++) {
        const tile = document.createElement("div");
        tile.className = "tile";
        row.appendChild(tile);
      }
      board.appendChild(row);
      
      
      // 行をタップ（クリック）したときの処理
      row.addEventListener("click", function(e) {
        // 縮小されていない行（現在入力中のアクティブな行など）は処理しない
        if (!this.classList.contains("inactive-row")) return;

        const currentIdx = i;

        // 【機能1】Shiftキーが押されており、かつ前回クリックした行が同じ盤面内にある場合（範囲選択）
        if (e.shiftKey && lastClickedIdx !== null) {
          const start = Math.min(lastClickedIdx, currentIdx);
          const end = Math.max(lastClickedIdx, currentIdx);
          
          // 【追加】今回クリックした行が「これから開く」のか「これから閉じる」のかを判定
          const isExpanding = !this.classList.contains("force-expand");
          
          // 前回クリックした位置から、今回クリックした位置までの行をすべて同じ状態に合わせる
          for (let k = start; k <= end; k++) {
            const targetRow = board.children[k];
            if (targetRow && targetRow.classList.contains("inactive-row")) {
              if (isExpanding) {
                targetRow.classList.add("force-expand");
              } else {
                targetRow.classList.remove("force-expand");
              }
            }
          }
        } else {
          // 【機能2】通常のクリック（単体での開閉切り替え）
          if (this.classList.contains("force-expand")) {
            this.classList.remove("force-expand");
          } else {
            this.classList.add("force-expand");
          }
        }

        // 最後にクリックされた行の番号を今回の位置に更新
        lastClickedIdx = currentIdx;
      });
    }
  }
}

// キーボードのスタイルとインライン背景を初期化し、使われない文字の枠を非表示にする
function resetKeyboardStyles() {
  // 現在の文字数の駅で使われているすべての文字を抽出してセットに突入させる
  const validChars = new Set();
  // ⭕️ 修正後：通常モードと同じく、すべての駅の文字を対象にする
  stations.forEach(s => {
    for (let char of s.yomi) validChars.add(char);
  });

  document.querySelectorAll(".key").forEach(key => {
    const char = key.textContent;
    
    // システムボタン（ENTER, BACK, CLEARなど）や実在する文字のキー
    if (char === "ENTER" || char === "BACK" || char === "CLEAR" || char === "確定" || char === "1字消す" || char === "全消去" || validChars.has(char)) {
      key.className = "key";
    } else {
      // どの駅名にも使われない文字のキーは非表示にする
      key.className = "key dummy";
    }
    key.style.background = ""; 
  });
}

// 【修正後：関数全体を置き換え】
// 引数に isRestore=false を追加し、復元中かどうかを判別できるようにします
function submitQuadGuess(isRestore = false) {
  // 復元中でない（プレイヤーの実際の入力）場合のみ、文字数と駅名のチェックを行う
  if (!isRestore) {
    if (currentGuess.length !== currentMode) {
      showMessage("文字数が足りません");
      return;
    }

    // 実在する駅名かどうかの辞書チェック
    const guessExists = stations.some(s => s.yomi === currentGuess);
    if (!guessExists) {
      showMessage("実在しない駅名です");
      return;
    }
  }

  // クアッド用のセーブデータ枠を取得する
  let stateKey = "quad" + currentMode;
  let st = savedState[stateKey];
  if (!st) {
    st = {guesses: [], guessTimes: [], quadSolved: [false,false,false,false], quadGridHistory: [], isOver: false};
    savedState[stateKey] = st;
  }

  // 各盤面の色結果を集約するための多次元配列
  let allBoardResults = [];
  // ▼▼▼ 追加：今回の判定前に、どの盤面が既にクリア済みだったかを記憶しておく ▼▼▼
  const prevQuadSolved = [...quadSolved];

  // 4つの盤面をループ処理して1つずつ色を判定していく
  for (let b = 0; b < 4; b++) {
    const board = document.getElementById(`board-${b}`);
    // 【修正後】クラス名から正確に何手目の行かを引っ張るように変更します
    const row = board.getElementsByClassName("board-row")[guessesSubmitted];
    const targetStation = quadStations[b];

    // すでにその盤面がクリア済みの場合は、灰色文字のスキップ表示にする
    if (quadSolved[b]) {
      const skipColors = Array(currentMode).fill("absent");
      allBoardResults.push(skipColors);
      
      for (let j = 0; j < currentMode; j++) {
        const tile = row.children[j];
        tile.textContent = currentGuess[j];
        tile.classList.add("absent");
        tile.style.opacity = "0.3"; // クリア済みスキップ枠は薄く見せる
      }
      continue;
    }

    // 内部の判定ロジックを呼び出して色の配列を取得
    const rowColors = checkRowColors(currentGuess, targetStation.yomi);
    allBoardResults.push(rowColors);

    // 盤面のタイルに文字と色を反映
    for (let j = 0; j < currentMode; j++) {
      const tile = row.children[j];
      tile.textContent = currentGuess[j];
      tile.classList.add(rowColors[j]);
    }

    // もし全ての文字が「correct（緑）」なら、この盤面はクリア！
    const isCorrectAll = rowColors.every(c => c === "correct");
    if (isCorrectAll) {
      quadSolved[b] = true;
      board.classList.add("cleared"); // 盤面全体をグレーアウト
      // 復元時であってもクリア済みなら「CLEARED!」の文字を出します
      if (!prevQuadSolved[b] && typeof showClearedAnimation === "function") {
        showClearedAnimation(board);
      }
    }
  }

  // 4色ブレンドキーボードの表示更新
  updateQuadKeyboardLogic(currentGuess, allBoardResults);
  
  // 履歴に今回の4盤面分の色結果（🟩🟨など）を保存する
  quadGridHistory.push(allBoardResults);

  // ▼▼▼ 【重要】保存処理（復元中でない場合のみ） ▼▼▼
  if (!isRestore) {
    st.guesses.push(currentGuess);
    st.guessTimes.push(Date.now());
    st.quadSolved = [...quadSolved];
    st.quadGridHistory = [...quadGridHistory];
  }

  // 手数を1つ進め、入力欄を空にする
  guessesSubmitted++;
  if (!isRestore) currentGuess = "";

  // 勝敗の判定
  const isAllCleared = quadSolved.every(s => s === true);
  if (isAllCleared || guessesSubmitted >= maxGuesses) {
    
    // ▼▼▼ ゲーム終了状態の保存 ▼▼▼
    if (!isRestore) {
      st.isOver = true;
      saveGameState();
      
      // 運行記録の保存（変数名が st で被るため stUser に変更しています）
      let targetMode = "quad" + currentMode; 
      if (!userStats[targetMode]) {
        userStats[targetMode] = { played: 0, won: 0, currentStreak: 0, maxStreak: 0, guesses: [] };
      }
      let stUser = userStats[targetMode];
      
      stUser.played++;
      if (isAllCleared) {
        stUser.won++;
        stUser.currentStreak++;
        if (stUser.currentStreak > stUser.maxStreak) stUser.maxStreak = stUser.currentStreak;
        // 最終的に全クリアした手数を記録する
        stUser.guesses[guessesSubmitted] = (stUser.guesses[guessesSubmitted] || 0) + 1;
      } else {
        stUser.currentStreak = 0;
      }
      localStorage.setItem("ekiPuzzleStatsV2", JSON.stringify(userStats));
     
      // アラートではなく、1.5秒待ってから専用の結果モーダルを美しく表示する
      setTimeout(showQuadResultModal, 1500);
    }
  } else {
    // 途中経過を保存
    if (!isRestore) saveGameState();
    
    // ▼▼▼ 修正：復元中（再読み込み時）は、タイルに余計な文字が残らないよう更新をスキップします ▼▼▼
    if (!isRestore && typeof updateTiles === "function") {
      updateTiles();
    }

    // ▼▼▼ 【重要】ここで残り駅数を再計算して画面を更新します ▼▼▼
    if (!isRestore && typeof updateQuadRemainingCounts === "function") {
      updateQuadRemainingCounts();
    }
  }
}

// 盤面クリア時のジャンプアニメーション生成関数 
// 指定された盤面（boardElement）の上に、CLEARED!の文字を配置します
function showClearedAnimation(boardElement) {
  const container = document.createElement("div");
  container.className = "cleared-animation-container";
  
  const text = "CLEARED!";
  // 1文字ずつspanタグで囲み、アニメーションの開始時間を0.05秒ずつズラすことでウェーブ状にジャンプさせる
  for (let i = 0; i < text.length; i++) {
    const span = document.createElement("span");
    span.textContent = text[i];
    span.style.animationDelay = `${i * 0.05}s`;
    container.appendChild(span);
  }
  
  boardElement.appendChild(container);
}


// クアッド専用の結果モーダルを表示する処理
function showQuadResultModal() {
  const isAllCleared = quadSolved.every(s => s === true);
  document.getElementById("quad-modal-title").textContent = isAllCleared ? "クアッド制覇！" : "残念！ゲームオーバー";
  
  // 4つの正解駅を2列のグリッドで表示
  let descHtml = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:14px; margin-bottom:15px; text-align:center;">`;
  for(let i = 0; i < 4; i++){
    let st = quadStations[i];
    let icon = quadSolved[i] ? "✅" : "❌";
    // 駅名部分をWikipediaリンク（st.url）で包み、色を整えます
    descHtml += `<div style="background:#f9f9f9; padding:5px; border-radius:5px;">${icon} <a href="${st.url}" target="_blank" style="color:inherit; text-decoration:none;"><b style="color:#333; border-bottom:1px dashed #666;">${st.kanji}</b></a><br><span style="font-size:11px; color:#666;">(${st.yomi})</span></div>`;
  }
  descHtml += `</div>`;
  document.getElementById("quad-modal-desc").innerHTML = descHtml;

  // クリア手数の計算と、田の字型への絵文字の流し込み
  let clearTurns = ["X", "X", "X", "X"];
  for(let b = 0; b < 4; b++) {
    let gridHtml = "";
    for(let i = 0; i < quadGridHistory.length; i++) {
      let colors = quadGridHistory[i][b];
      gridHtml += colors.map(c => colorToEmoji[c]).join("") + "<br>";
      if (clearTurns[b] === "X" && colors.every(c => c === "correct")) {
        clearTurns[b] = i + 1; // 何手目でクリアしたかを記録
      }
    }
    // 盤面ごとに絵文字とクリア手数を反映する
    const qGrid = document.getElementById(`q-grid-${b}`);
    if (qGrid) {
      qGrid.innerHTML = `<div style="font-weight:bold; margin-bottom:5px; font-size:14px;">${clearTurns[b]}</div>` + gridHtml;
    }
  }

  document.getElementById("quad-result-modal").classList.remove("hidden");
}

// クアッド専用のシェアテキストを組み立てる処理
// 手数表示をお洒落にコンパクト化し、ハッシュタグを拡張したシェア関数
function shareQuadResult(type) {
  let clearTurns = ["X", "X", "X", "X"];
  for(let b=0; b<4; b++) {
    for(let i=0; i<quadGridHistory.length; i++) {
      if (clearTurns[b] === "X" && quadGridHistory[i][b].every(c => c === "correct")) {
        clearTurns[b] = i + 1;
      }
    }
  }

  // お洒落に手数を配置するテキストの組み立て
  let text = `駅ドル Challenge ${currentMode}文字モード\n\n`;
  const emojify = (t) => t === "X" ? "🟥 ✕" : `🟩 ${t}手`;
  text += `① ${emojify(clearTurns[0])}  ② ${emojify(clearTurns[1])}\n`;
  text += `③ ${emojify(clearTurns[2])}  ④ ${emojify(clearTurns[3])}\n\n`;

  let currentUrl = window.location.href.split('?')[0];
  // 指定された新しいハッシュタグを追加
  text += `#駅ドル\n#駅ドルChallenge\n#駅ドルChallenge${currentMode}\n`;
  
  // 共通のシェア実行関数を呼び出し
  executeSharedShare(type, text, currentUrl);
}

// 通常モードの色判定処理を流用するためのラッパー（濁点・位置判定）
function checkRowColors(guess, answer) {
  let results = Array(guess.length).fill("absent");
  let answerLetters = answer.split("");
  let guessLetters = guess.split("");

  // 1巡目：位置も文字も合っている（緑色）の判定
  for (let i = 0; i < guess.length; i++) {
    if (guessLetters[i] === answerLetters[i]) {
      results[i] = "correct";
      answerLetters[i] = null;
      guessLetters[i] = null;
    }
  }
  // 2巡目：位置違い（黄色）の判定
  for (let i = 0; i < guess.length; i++) {
    if (guessLetters[i] === null) continue;
    const idx = answerLetters.indexOf(guessLetters[i]);
    if (idx !== -1) {
      results[i] = "present";
      answerLetters[idx] = null;
      guessLetters[i] = null;
    }
  }
  // 3巡目：濁点違い（紫色）の判定
  for (let i = 0; i < guess.length; i++) {
    if (guessLetters[i] === null) continue;
    // getBaseChar などの既存のグループ判定関数がグローバルにある前提
    const gGroup = typeof getBaseChar === "function" ? getBaseChar(guessLetters[i]) : guessLetters[i];
    
    for (let j = 0; j < answerLetters.length; j++) {
      if (answerLetters[j] === null) continue;
      const aGroup = typeof getBaseChar === "function" ? getBaseChar(answerLetters[j]) : answerLetters[j];
      if (gGroup === aGroup) {
        results[i] = "diacritic";
        answerLetters[j] = null;
        break;
      }
    }
  }
  return results;
}

// 色の優先強度の判定（緑 ＞ 黄 ＞ 紫 ＞ 灰）
function getQuadStrongerColor(curr, next) {
  const p = { "correct": 4, "present": 3, "diacritic": 2, "absent": 1, "default": 0 };
  return (p[next] || 0) > (p[curr] || 0) ? next : curr;
}

// キーボードの4分割色を割り当ててCSS変数を書き換える処理
function updateQuadKeyboardLogic(guessStr, resultsArray) {
  for (let i = 0; i < guessStr.length; i++) {
    let char = guessStr[i];
    if (!quadKeyColors[char]) {
      quadKeyColors[char] = ["default", "default", "default", "default"];
    }
    for (let b = 0; b < 4; b++) {
      let color = resultsArray[b][i];
      quadKeyColors[char][b] = getQuadStrongerColor(quadKeyColors[char][b], color);
    }
    const keyBtn = document.getElementById(`key-${char}`);
    if (keyBtn) {
      keyBtn.classList.add("quad-mode");
      keyBtn.style.setProperty("--c1", getQuadColorCodeStr(quadKeyColors[char][0])); // 左上
      keyBtn.style.setProperty("--c2", getQuadColorCodeStr(quadKeyColors[char][1])); // 右上
      keyBtn.style.setProperty("--c3", getQuadColorCodeStr(quadKeyColors[char][2])); // 左下
      keyBtn.style.setProperty("--c4", getQuadColorCodeStr(quadKeyColors[char][3])); // 右下
    }
  }
}

function getQuadColorCodeStr(name) {
  if (name === "correct") return "var(--correct-color)";
  if (name === "present") return "var(--present-color)";
  if (name === "diacritic") return "var(--diacritic-color)";
  if (name === "absent") return "var(--absent-color)";
  return "#d3d6da";
}


// 内部の色名を実際のカラーコード（CSS変数）に変換する関数
function getQuadColorCode(colorName) {
  if (colorName === "correct") return "var(--correct-color)";
  if (colorName === "present") return "var(--present-color)";
  if (colorName === "diacritic") return "var(--diacritic-color)";
  if (colorName === "absent") return "var(--absent-color)";
  return "#d3d6da"; // 未入力のデフォルト灰色
}


/* 【修正版】クアッドモードの残り候補駅数をリアルタイム計算する関数 */
function updateQuadRemainingCounts() {
  // クアッドモード以外のときは何もしない
  if (!isQuadMode) return;

  // セーブデータからこれまでの回答履歴（単語リスト）を安全に取得
  let stateKey = "quad" + currentMode;
  const guesses = savedState[stateKey]?.guesses || [];
  
  // 今の文字数と同じ長さの全駅リストを用意
  const basePool = stations.filter(s => s.yomi.length === currentMode);

  // 4つの盤面を1つずつチェックしていく
  for (let b = 0; b < 4; b++) {
    const counterEl = document.getElementById(`quad-remain-${b}`);
    if (!counterEl) continue;

    // ▼▼▼ ここを修正：まだ1手目も入力していない時は、非表示にせず「--駅」のままにする ▼▼▼
    if (guesses.length === 0) {
      counterEl.textContent = "残り -- 駅";
      continue;
    }
    // ▲▲▲ 修正ここまで ▲▲▲

    // すでにクリアしている盤面は計算をスキップして「CLEAR!」と表示
    if (quadSolved[b]) {
      counterEl.textContent = "CLEAR!";
      continue;
    }

    const targetYomi = quadStations[b].yomi;
    let pool = [...basePool];
    
    // 送信済みの回答リストを1単語ずつシミュレーションにかけて駅プールを絞り込む
    for (let i = 0; i < guesses.length; i++) {
      const g = guesses[i];
      if (!g) continue;

      // ★修正箇所：判定アルゴリズムのズレを防ぐため、実際の色の判定にも共通関数「evaluateGuess」を使う
      const actualColors = evaluateGuess(g, targetYomi);
      const gArr = g.split("");

      // 今回の回答結果と矛盾する駅を候補から外していく
      pool = pool.filter(s => {
        let simColors = evaluateGuess(g, s.yomi, gArr);
        for (let j = 0; j < currentMode; j++) {
          if (simColors[j] !== actualColors[j]) return false;
        }
        return true;
      });
    }

    // 計算し終わった残り件数を画面に表示する
    counterEl.textContent = `残り ${pool.length} 駅`;
  }
}



// ==========================================
// データのエクスポートとインポート（改ざん防止機能付き）
// ==========================================
// 共通関数を呼び出してデータを書き出す（駅ドル用）
async function exportUserData() {
  // このゲームで保存したいキーと中身のリストを作成
  const dataMap = {
    stats: localStorage.getItem("ekiPuzzleStatsV2"),
    zukan: localStorage.getItem("ekiZukanData"),
    meta: localStorage.getItem("ekiZukanMeta"),
    achievements: localStorage.getItem("ekiAchievements"),
    settings: localStorage.getItem("ekiSettings"),
    version: localStorage.getItem("ekiSystemVersion"),
    log: localStorage.getItem("ekiPuzzleStateV1_Log")
  };

  try {
    // 共通関数へゲーム名「Ekidle」とデータを渡してコードを生成
    const code = await generateSharedTransferCode("Ekidle", dataMap);
    navigator.clipboard.writeText(code).then(() => {
      alert("運行記録などのデータを引き継ぎコードとしてコピーしました！\n\nメモ帳などに貼り付けて大切に保管してください。");
    });
  } catch (err) {
    alert("コードの生成に失敗しました。");
    console.error(err);
  }
}

// 共通関数を呼び出してデータを復元する（駅ドル用）
async function importUserData(code) {
  try {
    // 共通関数へコードを渡し、ゲーム名「Ekidle」のデータとして安全に解凍・検証
    const json = await parseSharedTransferCode(code, "Ekidle");

    // 検証を通過したら、データが存在するものだけLocalStorageに書き戻す
    if(json.stats) localStorage.setItem("ekiPuzzleStatsV2", json.stats);
    if(json.zukan) localStorage.setItem("ekiZukanData", json.zukan);
    if(json.meta) localStorage.setItem("ekiZukanMeta", json.meta);
    if(json.achievements) localStorage.setItem("ekiAchievements", json.achievements);
    if(json.settings) localStorage.setItem("ekiSettings", json.settings);
    if(json.version) localStorage.setItem("ekiSystemVersion", json.version); 
    if(json.log) localStorage.setItem("ekiPuzzleStateV1_Log", json.log);
    
    alert("データを正常に復元しました！再読み込みを行います。");
    location.reload();
  } catch(e) { 
    alert("無効な引き継ぎコードです。正しくコピーできているか確認してください。"); 
    console.error("インポートエラー:", e);
  }
}
