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
localStorage.clear();
alert('答えを「'+newAns+'」に設定し、すべての入力値をリセットします。');
location.reload();
}
});
document.getElementById('admin-rand-btn').addEventListener('click',()=>{
const list=window.stations||window.stationsList||window.allStations||(typeof stations!=='undefined'?stations:null);
if(list&&list.length>0&&typeof todayStation!=='undefined'&&todayStation!==null){
const currentLength=todayStation.yomi.length;
const filteredList=list.filter(s=>{
const name=typeof s==='string'?s:(s.yomi||s.name);
return name&&name.length===currentLength;
});
if(filteredList.length>0){
const randStation=filteredList[Math.floor(Math.random()*filteredList.length)];
const newAns=typeof randStation==='string'?randStation:(randStation.yomi||randStation.name);
sessionStorage.setItem('admin_override_ans',newAns);
localStorage.clear();
alert('現在の'+currentLength+'文字モードに合わせて、ランダムに「'+newAns+'」を選びました。入力値をリセットします。');
location.reload();
}else{
alert('エラー：現在の文字数（'+currentLength+'文字）に一致する駅データが見つかりませんでした。');
}
}else{
alert('エラー：駅データが見つからないか、ゲームがまだ読み込まれていません。');
}
});
document.getElementById('admin-reset-btn').addEventListener('click',()=>{
localStorage.clear();
alert('現在のプレイ状況（入力値）を完全にリセットしました。');
location.reload();
});
