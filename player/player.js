// 跟讀播放器：所有課共用。課程資料由 lessons.js 讀取後傳進來。
window.GenduPlayer=function(LESSON){
const app=document.getElementById('app');
document.title=LESSON.title+' 跟讀';
app.className='wrap';
app.innerHTML=`
  <a class="back" href="index.html">‹ 所有課程</a>
  <header>
    <div>
      <div class="lessontag"></div>
      <h1 id="ttl"></h1>
      <p class="sub">聽一句，跟著唸一句</p>
    </div>
    <div class="count" id="count"></div>
  </header>
  <div class="bar"><i id="bar"></i></div>
  <section class="card" aria-live="polite">
    <div class="top"><span class="clock" id="clock"></span><span class="status" id="status">按「開始」</span></div>
    <p class="en" id="en"></p>
    <p class="zh" id="zh"></p>
    <div class="ring" id="ring" hidden>
      <svg viewBox="0 0 50 50"><circle class="bg" cx="25" cy="25" r="20"/><circle class="fg" id="arc" cx="25" cy="25" r="20" stroke-dasharray="125.66" stroke-dashoffset="0"/></svg>
      <span>換你唸！</span>
    </div>
    <div class="controls">
      <button class="icon" id="prev" aria-label="上一句"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg></button>
      <button class="icon" id="again" aria-label="重聽這句"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v5h5"/></svg></button>
      <button class="big" id="play">開始</button>
      <button class="icon" id="next" aria-label="下一句"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg></button>
    </div>
  </section>
  <section class="settings">
    <div class="set"><b>唸完之後</b><div class="seg" data-key="mode"><button data-v="auto">自動下一句</button><button data-v="tap">按「唸完了」</button></div></div>
    <div class="set"><b>播放速度</b><div class="seg" data-key="rate"><button data-v="0.75">慢</button><button data-v="0.9">稍慢</button><button data-v="1">正常</button></div></div>
    <div class="set"><b>小孩唸的時間</b><div class="seg" data-key="wait"><button data-v="1.3">短</button><button data-v="1.7">中</button><button data-v="2.2">長</button></div></div>
    <div class="set"><b>顯示</b><div class="seg" data-key="show"><button data-v="both">英文＋中文</button><button data-v="en">只有英文</button><button data-v="none">挑戰</button></div></div>
  </section>
  <section class="script" id="script">
    <h2>全文　<span class="sub" style="font-family:var(--body);font-size:.85rem">點任一句就從那裡開始</span></h2>
  </section>
  <details>
    <summary>家長用：句子切得不準時微調</summary>
    <div class="tune" id="tune" style="margin-top:8px"></div>
  </details>
  <audio id="au" preload="auto"></audio>`;

const $=id=>document.getElementById(id), au=$('au');
au.src=LESSON.audio||'audio.mp3';
$('ttl').textContent=LESSON.title;
app.querySelector('.lessontag').textContent=(LESSON.label||'');

const L=[];LESSON.sections.forEach(s=>s.lines.forEach(l=>L.push({t:s.t,s:l[0],e:l[1],en:l[2],zh:l[3]})));
const N=L.length;
// 全域設定（所有課共用）與每課資料（進度、微調）分開存
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const P='gendu.'+LESSON.id+'.';
const baseSig=L.map(x=>x.s+','+x.e).join('|');
let adj=store.get(P+'adj',{});
if(store.get(P+'adjbase','')!==baseSig){adj={};store.set(P+'adj',adj);store.set(P+'adjbase',baseSig)}

const S={i:0,phase:'idle',running:false,
  mode:store.get('gendu.mode','auto'),rate:store.get('gendu.rate','0.9'),wait:store.get('gendu.wait','1.7'),show:store.get('gendu.show','both'),
  done:new Set(store.get(P+'done',[]))};
let timer=null,raf=null;
const PAD_S=.12,PAD_E=.2;
function bounds(i){const a=adj[i]||{s:0,e:0};const l=L[i];let s=Math.max(0,l.s-PAD_S+a.s),e=l.e+PAD_E+a.e;if(i<N-1)e=Math.min(e,L[i+1].s+((adj[i+1]&&adj[i+1].s)||0)-.05);return[s,e]}

const scr=$('script');const lnEls=[];
LESSON.sections.forEach(sec=>{const d=document.createElement('div');d.className='sec';d.innerHTML='<div class="time"></div><div class="lines"></div>';d.querySelector('.time').textContent=sec.t||'';const box=d.querySelector('.lines');
  sec.lines.forEach(()=>{const i=lnEls.length,l=L[i],b=document.createElement('button');b.className='ln';b.innerHTML='<span class="e"></span><span class="c"></span>';b.querySelector('.e').textContent=l.en;b.querySelector('.c').textContent=l.zh;b.onclick=()=>{go(i);listen()};box.appendChild(b);lnEls.push(b)});
  scr.appendChild(d)});

document.querySelectorAll('.seg').forEach(g=>{const k=g.dataset.key;g.querySelectorAll('button').forEach(b=>{b.setAttribute('aria-pressed',String(S[k]===b.dataset.v));b.onclick=()=>{S[k]=b.dataset.v;store.set('gendu.'+k,S[k]);g.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));if(k==='rate')au.playbackRate=+S.rate;render()}})});

const ICON_EAR='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 10v4M7 7v10M11 4v16M15 8v8M19 11v2"/></svg>';
const ICON_MIC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
function setStatus(){const st=$('status');st.className='status';
  if(S.phase==='listen'){st.classList.add('listen');st.innerHTML=ICON_EAR+'仔細聽';}
  else if(S.phase==='say'){st.classList.add('say');st.innerHTML=ICON_MIC+'換你唸';}
  else if(S.phase==='end'){st.classList.add('say');st.textContent='全部唸完了！好棒！';}
  else st.textContent='暫停中';}
function render(){const l=L[S.i];$('en').textContent=l.en;$('zh').textContent=l.zh;
  $('en').classList.toggle('hide',S.show==='none'&&S.phase==='listen');
  $('zh').hidden=S.show!=='both'||!l.zh;
  $('clock').textContent=l.t||'';$('clock').hidden=!l.t;
  $('count').textContent=(S.i+1)+' / '+N;$('bar').style.width=((S.i+1)/N*100)+'%';
  lnEls.forEach((b,k)=>{b.classList.toggle('cur',k===S.i);b.classList.toggle('ok',S.done.has(k))});
  app.classList.toggle('nozh',S.show!=='both');
  const p=$('play');const tap=S.phase==='say'&&S.mode==='tap';p.classList.toggle('done',tap);
  p.textContent=tap?'我唸完了':S.running?'暫停':(S.phase==='end'?'從頭再來':'開始');
  setStatus();renderTune();}
function clearT(){clearTimeout(timer);cancelAnimationFrame(raf);$('ring').hidden=true}
function scrollCur(){if(window.scrollY>2)window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}
function go(i){clearT();au.pause();S.i=Math.max(0,Math.min(N-1,i));S.phase='idle';S.running=false;render();scrollCur()}
function listen(){clearT();scrollCur();const[s,e]=bounds(S.i);S.phase='listen';S.running=true;render();
  au.playbackRate=+S.rate;au.currentTime=s;const pr=au.play();if(pr)pr.catch(()=>{S.running=false;S.phase='idle';render()});
  const tick=()=>{if(!S.running||S.phase!=='listen')return;if(au.currentTime>=e){au.pause();say()}else raf=requestAnimationFrame(tick)};raf=requestAnimationFrame(tick)}
function say(){S.phase='say';S.done.add(S.i);store.set(P+'done',[...S.done]);render();
  if(S.mode==='tap')return;
  const[s,e]=bounds(S.i);const dur=((e-s)/+S.rate)*(+S.wait)+1.2;const t0=performance.now();$('ring').hidden=false;
  const arc=$('arc');const tick=()=>{const p=Math.min(1,(performance.now()-t0)/1000/dur);arc.style.strokeDashoffset=125.66*p;if(p<1)raf=requestAnimationFrame(tick)};raf=requestAnimationFrame(tick);
  timer=setTimeout(advance,dur*1000)}
function advance(){clearT();if(S.i>=N-1){S.phase='end';S.running=false;render();return}S.i++;render();scrollCur();timer=setTimeout(listen,350)}
function pause(){clearT();au.pause();S.running=false;S.phase='idle';render()}
$('play').onclick=()=>{if(S.phase==='say'&&S.mode==='tap'){advance();return}
  if(S.phase==='end'){go(0);listen();return}
  S.running?pause():listen()};
$('again').onclick=()=>listen();
$('prev').onclick=()=>{const r=S.running;go(S.i-1);if(r)listen()};
$('next').onclick=()=>{const r=S.running;go(S.i+1);if(r)listen()};
document.addEventListener('keydown',e=>{if(e.target.closest('button,a'))return;if(e.code==='Space'){e.preventDefault();$('play').click()}else if(e.key==='ArrowRight')$('next').click();else if(e.key==='ArrowLeft')$('prev').click()});

function renderTune(){const a=adj[S.i]||{s:0,e:0},t=$('tune');const f=x=>(x>=0?'+':'')+x.toFixed(1);
  t.innerHTML='第 '+(S.i+1)+' 句　開始 <button data-k="s" data-d="-0.1">早 0.1 秒</button><button data-k="s" data-d="0.1">晚 0.1 秒</button>　結束 <button data-k="e" data-d="-0.1">早 0.1 秒</button><button data-k="e" data-d="0.1">晚 0.1 秒</button> <button data-k="r">還原</button> <span>('+f(a.s)+' / '+f(a.e)+')</span><br><button data-k="c">複製全部時間（貼到 timing.txt）</button> <span id="copymsg"></span><textarea id="copybox" readonly hidden rows="4" style="width:100%;font:12px monospace;margin-top:6px"></textarea>';
  t.querySelectorAll('button').forEach(b=>b.onclick=()=>{if(b.dataset.k==='c'){copyTiming();return}const cur=adj[S.i]||{s:0,e:0};if(b.dataset.k==='r')delete adj[S.i];else{cur[b.dataset.k]=Math.round((cur[b.dataset.k]+ +b.dataset.d)*10)/10;adj[S.i]=cur}store.set(P+'adj',adj);listen()})}
function copyTiming(){const txt=L.map((_,i)=>{const a=adj[i]||{s:0,e:0};return (Math.round((L[i].s+a.s)*100)/100)+' '+(Math.round((L[i].e+a.e)*100)/100)}).join('\n');
  const box=$('copybox'),msg=$('copymsg');box.value=txt;
  const shown=()=>{box.hidden=false;box.focus();box.select();msg.textContent='請全選複製下面的內容'};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(()=>{msg.textContent='已複製 '+L.length+' 行，到 GitHub 這一課的資料夾新增 timing.txt 貼上即可'},shown);else shown()}
au.playbackRate=+S.rate;render();
};
