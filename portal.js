// 先頭行に追加することで、VS Codeがこのファイル全体をTypeScriptと同等に検査してくれます
// @ts-check

// 画面のHTMLパーツ（DOM）がすべて読み込まれてからスクリプトを実行します
window.addEventListener("DOMContentLoaded", () => {

  // ▼ 一括バックアップ処理 ▼
  const btnExportAll = document.getElementById("btn-export-all");
  if (btnExportAll) {
    btnExportAll.addEventListener("click", async (e) => {
      e.preventDefault(); // リンク本来の画面遷移をストップします
      const dataMap = {};
      
      // パソコン（ブラウザ）の中に保存されている「eki」から始まる全データを自動でかき集める
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("eki")) {
          dataMap[key] = localStorage.getItem(key);
        }
      }
      
      // 保存されているデータが1つもない場合はエラーメッセージを出して終了します
      if (Object.keys(dataMap).length === 0) {
        alert("保存されているセーブデータがありません。");
        return;
      }

      try {
        // common.jsの関数を使って「PortalAll」というゲーム名で全データを圧縮・暗号化します
        // ※HTML側でこのファイルより先に common.js が読み込まれている必要があります
        const code = await generateSharedTransferCode("PortalAll", dataMap);
        
        // 生成した暗号コードをクリップボード（コピー状態）に書き込みます
        navigator.clipboard.writeText(code).then(() => {
          alert("すべてのゲームのセーブデータをまとめた「引き継ぎコード」をコピーしました！\n\nメモ帳などに大切に保管してください。");
        });
      } catch (err) {
        alert("コードの生成に失敗しました。");
        console.error(err);
      }
    });
  }


  // ▼ 一括復元処理 ▼
  const btnImportAll = document.getElementById("btn-import-all");
  if (btnImportAll) {
    btnImportAll.addEventListener("click", async (e) => {
      e.preventDefault();
      
      // ユーザーに引き継ぎコードの入力を求めます
      const code = prompt("一括引き継ぎコードを入力してください：");
      if (!code) return; // キャンセルされた場合は何もしない

      try {
        // common.jsの関数を使って「PortalAll」のデータを安全に解凍・検証します
        const json = await parseSharedTransferCode(code, "PortalAll");
        
        let restoreCount = 0;
        
        // 復元されたデータの中身を1つずつ確認し、管理用のタグ以外をすべてLocalStorageに書き戻します
        Object.keys(json).forEach(key => {
          // "game"（ゲーム名）, "payload"（中身）, "sig"（改ざん防止コード）は除外します
          if (key !== "game" && key !== "payload" && key !== "sig") {
            localStorage.setItem(key, json[key]);
            restoreCount++;
          }
        });
        
        alert(restoreCount + " 個のセーブデータ項目を正常に復元しました！\n各ゲームのページを再読み込みしてください。");
      } catch (err) {
        alert("無効な引き継ぎコードです。正しくコピーできているか、一括バックアップ用のコードか確認してください。");
        console.error(err);
      }
    });
  }


  // ▼ 非常用リセット時の警告処理 ▼
  // HTML側から onclick="return confirm(...)" を排除し、JS側で警告ダイアログを制御します
  const btnEmergency = document.getElementById("btn-emergency");
  if (btnEmergency) {
    btnEmergency.addEventListener("click", (e) => {
      const confirmReset = confirm('【警告】\n駅ドル・駅ロケ等のすべてのセーブデータが完全に消去されます。\n本当によろしいですか？');
      
      // キャンセルが押された場合のみ、リンクの移動（リセットの実行）をブロックします
      if (!confirmReset) {
        e.preventDefault(); 
      }
    });
  }

  // ▼ 設定メニューの開閉処理 ▼
  // 「設定」カードと、展開されるコマンド群のコンテナを取得します
  const btnSettingsToggle = document.getElementById("btn-settings-toggle");
  const managementActions = document.getElementById("management-actions");

  if (btnSettingsToggle && managementActions) {
    btnSettingsToggle.addEventListener("click", (e) => {
      e.preventDefault(); // リンク本来の挙動（画面遷移など）を防止します
      
      // クラス名「is-active」の有無を切り替えることで、CSS側で表示・非表示を制御します
      managementActions.classList.toggle("is-active");
    });
  }

});
