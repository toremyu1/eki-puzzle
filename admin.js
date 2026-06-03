const savedAns=sessionStorage.getItem('admin_override_ans');
const adminPanel=document.createElement('div');
adminPanel.id='admin-panel';
adminPanel.style.padding='10px';
adminPanel.style.background='#ffebee';
adminPanel.style.border='2px solid #f44336';
adminPanel.style.marginBottom='15px';
adminPanel.innerHTML=`
<b>🛠 管理者モード</b><br>
現在の答え: <span id="debug-ans-text">（読込中...）</span><br>
<input type="text" id="admin-custom-ans" placeholder="新しい答え(ひらがな)" style="padding:4px;margin-right:5px;">
<button id="admin-set-btn" style="margin-right:5px;">確定変更</button>
<button id="admin-rand-btn" style="margin-right:5px;">ランダム変更</button>
<button id="admin-reset-btn">入力値リセット</button>
`;
document.querySelector('header').insertAdjacentElement('afterend',adminPanel);
setInterval(()=>{
if(typeof todayStation!=='undefined'&&todayStation!==null){
if(savedAns&&todayStation.yomi!==savedAns){
todayStation.yomi=savedAns;
if(todayStation.name)todayStation.name=savedAns;
}
document.getElementById('debug-ans-text').textContent=todayStation.yomi;
}
},100);
document.getElementById('admin-set-btn').addEventListener('click',()=>{
const newAns=document.getElementById('admin-custom-ans').value.trim();
if(newAns!==''){
sessionStorage.setItem('admin_override_ans',newAns);
alert('答えを「'+newAns+'」に設定し、ゲームをリセットします。');
location.reload();
}
});
document.getElementById('admin-rand-btn').addEventListener('click',()=>{
const list=window.stations||window.stationsList||window.allStations||(typeof stations!=='undefined'?stations:null);
if(list&&list.length>0){
const randStation=list[Math.floor(Math.random()*list.length)];
const newAns=typeof randStation==='string'?randStation:(randStation.yomi||randStation.name);
sessionStorage.setItem('admin_override_ans',newAns);
alert('ランダムに「'+newAns+'」が選ばれました。ゲームをリセットします。');
location.reload();
}else{
alert('エラー：全駅データ（配列）が自動で見つかりませんでした。app.js内にある駅リストの配列名を確認してください。');
}
});
document.getElementById('admin-reset-btn').addEventListener('click',()=>{
alert('現在のプレイ状況（入力値）をリセットします。');
location.reload();
});
