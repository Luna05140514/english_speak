// 讀取課程：lessons/ 底下每個資料夾是一課，裡面放固定檔名的檔案
//   audio.mp3    課文音檔（必要）
//   english.txt  英文課文，一行一句（必要）；[7:00] 這種方括號開頭是段落標題
//   chinese.txt  中文翻譯，一行對一行英文（可省略）
//   timing.txt   每句開始、結束秒數（可省略，沒有就自動斷句）
(function(){
const store={
  get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
};
function repoInfo(){
  const h=location.hostname, m=h.match(/^([^.]+)\.github\.io$/i);
       if(!m)return {owner:'Luna05140514',repo:'english_speak'};
  const seg=location.pathname.split('/').filter(Boolean);
  const first=seg[0]&&!/\.html?$/i.test(seg[0])?seg[0]:null;
  return {owner:m[1],repo:first||h};
}
function lessonPath(folder,file){return 'lessons/'+encodeURIComponent(folder)+'/'+file}
function displayName(folder){
  const mm=folder.match(/^(\d+)[\s._-]*(.*)$/);
  return mm?{num:String(+mm[1]),title:mm[2]||folder}:{num:'',title:folder};
}
async function listLessons(){
  const cached=store.get('gendu.list',null);
  const ri=repoInfo();
  if(ri){
    try{
      const r=await fetch(`https://api.github.com/repos/${ri.owner}/${ri.repo}/contents/lessons`,{headers:{Accept:'application/vnd.github+json'}});
      if(r.ok){const arr=await r.json();const list=arr.filter(x=>x.type==='dir').map(x=>x.name).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));store.set('gendu.list',list);return list}
    }catch(e){}
  }
  try{
    const r=await fetch('lessons.txt',{cache:'no-cache'});
    if(r.ok){const list=(await r.text()).split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#'));if(list.length)return list}
  }catch(e){}
  return cached||[];
}
function parseText(txt){
  // 回傳 [{t:段落, en:句子}]；[xxx] 開頭是段落標題
  const out=[];let sec='';
  txt.replace(/^﻿/,'').split(/\r?\n/).forEach(raw=>{
    let s=raw.trim();if(!s)return;
    const h=s.match(/^\[([^\]]*)\]\s*(.*)$/);
    if(h){sec=h[1].trim();s=h[2].trim();if(!s)return}
    out.push({t:sec,en:s});
  });
  return out;
}
function parseLines(txt){
  return txt.replace(/^﻿/,'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean)
    .map(s=>s.replace(/^\[[^\]]*\]\s*/,'')).filter(Boolean);
}
async function getText(url){try{const r=await fetch(url,{cache:'no-cache'});return r.ok?await r.text():null}catch(e){return null}}
function sig(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return h+':'+s.length}
async function loadLesson(folder,onStatus){
  const en=await getText(lessonPath(folder,'english.txt'));
  if(en==null)throw new Error('找不到 english.txt');
  const items=parseText(en);
  if(!items.length)throw new Error('english.txt 是空的');
  const zhTxt=await getText(lessonPath(folder,'chinese.txt'));
  const zh=zhTxt?parseLines(zhTxt):[];
  items.forEach((it,i)=>it.zh=zh[i]||'');
  const audioUrl=lessonPath(folder,'audio.mp3');
  let times=null, source='';
  const tm=await getText(lessonPath(folder,'timing.txt'));
  if(tm){
    const rows=tm.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(s=>s.split(/[\s,\t]+/).map(Number)).filter(r=>r.length>=2&&!isNaN(r[0])&&!isNaN(r[1]));
    if(rows.length===items.length){times=rows.map(r=>[r[0],r[1]]);source='timing'}
  }
  if(!times){
    const key='gendu.align.'+folder, s=sig(en);
    const c=store.get(key,null);
    if(c&&c.sig===s&&c.times.length===items.length){times=c.times;source='cache'}
    else{
      onStatus&&onStatus('正在分析音檔，自動斷句中…');
      const r=await fetch(audioUrl);if(!r.ok)throw new Error('找不到 audio.mp3');
      const buf=await r.arrayBuffer();
      const AC=window.AudioContext||window.webkitAudioContext;const ac=new AC();
      const ab=await new Promise((ok,no)=>{const p=ac.decodeAudioData(buf,ok,no);if(p&&p.then)p.then(ok,no)});
      let d=ab.getChannelData(0);
      if(ab.numberOfChannels>1){const d2=ab.getChannelData(1),m=new Float32Array(d.length);for(let i=0;i<d.length;i++)m[i]=(d[i]+d2[i])/2;d=m}
      times=GenduAlign.align(d,ab.sampleRate,items.map(x=>x.en));
      try{ac.close()}catch(e){}
      store.set(key,{sig:s,times});source='auto';
    }
  }
  const sections=[];
  items.forEach((it,i)=>{
    let sec=sections[sections.length-1];
    if(!sec||sec.t!==it.t){sec={t:it.t,lines:[]};sections.push(sec)}
    sec.lines.push([times[i][0],times[i][1],it.en,it.zh]);
  });
  const dn=displayName(folder);
  return {id:folder,title:dn.title,label:dn.num?'Lesson '+dn.num:'',audio:audioUrl,sections,source,hasZh:zh.length>0};
}
window.GenduLessons={listLessons,loadLesson,displayName,store};
})();
