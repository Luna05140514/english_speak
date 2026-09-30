// 自動斷句：依音量找出停頓，再依每句英文的長度，把音檔分配給每一句。
(function(root){
function syllables(line){
  const words=(line.toLowerCase().match(/[a-z']+/g)||[]);
  let n=0;for(const w of words){const g=w.replace(/e$/,'').match(/[aeiouy]+/g);n+=Math.max(1,g?g.length:1)}
  return Math.max(1,n);
}
function align(samples,sampleRate,lines){
  // 先降到約 16kHz（取平均），讓不同取樣率的音檔結果一致
  const k=Math.max(1,Math.round(sampleRate/16000));
  if(k>1){const n=Math.floor(samples.length/k),d=new Float32Array(n);for(let i=0;i<n;i++){let s=0;for(let j=0;j<k;j++)s+=samples[i*k+j];d[i]=s/k}samples=d;sampleRate=sampleRate/k}
  const N=lines.length, F=0.05, hop=Math.round(sampleRate*F), nf=Math.floor(samples.length/hop);
  const db=new Float32Array(nf);
  for(let i=0;i<nf;i++){let s=0;const o=i*hop;for(let k=0;k<hop;k++){const x=samples[o+k];s+=x*x}db[i]=20*Math.log10(Math.sqrt(s/hop)+1e-9)}
  // 平滑：前後 2 格取最大值
  const sm=new Float32Array(nf);
  for(let i=0;i<nf;i++){let m=-999;for(let k=Math.max(0,i-2);k<=Math.min(nf-1,i+2);k++)if(db[k]>m)m=db[k];sm[i]=m}
  // 門檻：安靜/背景音樂 與 人聲 之間
  let mx=-999;for(const v of sm)if(v>mx)mx=v;
  const vals=Array.from(sm).filter(v=>v>mx-60).sort((a,b)=>a-b);
  const q=p=>vals[Math.min(vals.length-1,Math.floor(p*vals.length))];
  const th=(q(0.2)+q(0.95))/2;
  const voiced=new Uint8Array(nf);for(let i=0;i<nf;i++)voiced[i]=sm[i]>th?1:0;
  // 去掉太短的聲音（< 0.15 秒）
  for(let i=0;i<nf;){if(voiced[i]){let j=i;while(j<nf&&voiced[j])j++;if(j-i<3)for(let k=i;k<j;k++)voiced[k]=0;i=j}else i++}
  const cum=new Int32Array(nf+1);for(let i=0;i<nf;i++)cum[i+1]=cum[i]+voiced[i];
  let first=0;while(first<nf&&!voiced[first])first++;
  let last=nf-1;while(last>0&&!voiced[last])last--;
  if(first>=last)throw new Error('聽不到聲音');
  // 候選停頓（聲音之間的空檔）
  const gaps=[];
  for(let i=first;i<=last;){if(!voiced[i]){let j=i;while(j<=last&&!voiced[j])j++;gaps.push({s:i,e:j,len:(j-i)*F});i=j}else i++}
  const m=gaps.length;
  if(m<N-1)throw new Error('找到的停頓比句子少，請檢查課文行數或音檔');
  // 邊界 0 = 開頭，1..m = 停頓，m+1 = 結尾
  const B=[{s:first,e:first}].concat(gaps,[{s:last+1,e:last+1}]);
  const w=lines.map(syllables), W=w.reduce((a,b)=>a+b,0), Vt=cum[last+1]-cum[first];
  const exp=w.map(x=>Vt*F*x/W);
  const P=new Float64Array(m+2); // 內部停頓懲罰累積
  for(let g=1;g<=m;g++){const L=B[g].len;P[g]=P[g-1]+6*Math.max(0,L-0.1)**2+(L>0.6?4*(L-0.6):0)}
  const INF=1e18;
  let prev=new Float64Array(m+2).fill(INF);prev[0]=0;
  const back=[];
  for(let j=0;j<N;j++){
    const cur=new Float64Array(m+2).fill(INF),bk=new Int32Array(m+2).fill(-1);
    const qMin=j+1, qMax=(j===N-1)?m+1:m-(N-2-j);
    for(let qq=qMin;qq<=qMax;qq++){
      if(j===N-1&&qq!==m+1)continue;
      for(let p=j;p<qq;p++){if(prev[p]>=INF)continue;
        const v=(cum[B[qq].s]-cum[B[p].e])*F, d=v-exp[j];
        const c=prev[p]+d*d/(exp[j]+0.6)+(P[qq-1]-P[p]);
        if(c<cur[qq]){cur[qq]=c;bk[qq]=p}}
    }
    back.push(bk);prev=cur;
  }
  // 回溯
  const idx=new Array(N+1);idx[N]=m+1;
  for(let j=N-1;j>=0;j--)idx[j]=back[j][idx[j+1]];
  const out=[];
  for(let j=0;j<N;j++){
    let a=B[idx[j]].e, b=B[idx[j+1]].s-1;
    while(a<b&&!voiced[a])a++;while(b>a&&!voiced[b])b--;
    out.push([+(a*F).toFixed(2),+((b+1)*F).toFixed(2)]);
  }
  return out;
}
root.GenduAlign={align,syllables};
})(typeof window!=='undefined'?window:globalThis);
