/* 指力训练计时器 · 统一数据模型
 * 一个「计划」= 若干「动作块」
 * 块 = { name, type:'time'|'reps', work, target, rounds, rest, sets, setRest }
 *   指力板：type=time, work=7, rounds=6, rest=3, sets=3, setRest=120
 *   引体  ：type=reps, rounds=1, sets=3, setRest=90
 */
'use strict';

/* ─────────── 计划预设 ─────────── */
const PLANS = {
  fbo: {
    name:'开握 7:50',
    blocks:[
      { name:'开握悬挂', type:'time', work:7, target:'7 秒', rounds:6, rest:3, sets:3, setRest:120 }
    ]
  },
  fbh: {
    name:'半抠 5:55',
    blocks:[
      { name:'半抠悬挂', type:'time', work:5, target:'5 秒', rounds:5, rest:5, sets:3, setRest:120 }
    ]
  },
  fbm: {
    name:'开握 + 半抠',
    blocks:[
      { name:'开握悬挂', type:'time', work:7, target:'7 秒', rounds:6, rest:3, sets:3, setRest:120 },
      { name:'半抠悬挂', type:'time', work:5, target:'5 秒', rounds:5, rest:5, sets:3, setRest:120 }
    ]
  },
  arm: {
    name:'手臂 + 背部',
    blocks:[
      { name:'引体向上',     type:'reps', target:'8–12 次',  rounds:1, sets:3, setRest:90,
        alts:['引体向上','反向划船','跳跃引体+离心','离心引体'] },
      { name:'俯卧撑',       type:'reps', target:'12–15 次', rounds:1, sets:3, setRest:90,
        alts:['标准俯卧撑','跪姿俯卧撑','窄距俯卧撑'] },
      { name:'澳式划船',     type:'reps', target:'10 次',     rounds:1, sets:3, setRest:90 },
      { name:'小臂静态弯举', type:'reps', target:'15 次（停 2 秒）', rounds:1, sets:3, setRest:60 },
      { name:'平板支撑',     type:'time', work:45, target:'30–60 秒', rounds:1, sets:3, setRest:60,
        alts:['平板支撑','侧平板'] }
    ]
  },
  custom: { name:'自定义', blocks:[] }
};

const KEY = 'hb_v3', HKEY = 'hb_hist_v3';

let cfg = {
  planId:'fbo',
  planName:'开握 7:50',
  blocks: JSON.parse(JSON.stringify(PLANS.fbo.blocks)),
  pick:{},                         // 每个块选中的变式下标
  warm:300, cool:180, prep:5,
  voice:true, beep:true, vibrate:true, wake:true,
  music:false, trackId:'', tracks:[]
};

function save(){ try{ localStorage.setItem(KEY, JSON.stringify(cfg)); }catch(e){} }
function load(){
  try{
    const s = JSON.parse(localStorage.getItem(KEY));
    if(s && s.blocks) Object.assign(cfg, s);
  }catch(e){}
}

const $ = id => document.getElementById(id);
const fmt = s => {
  s = Math.max(0, Math.ceil(s));
  return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
};
const mmss = s => {
  const n = Math.round(s);
  if(n < 60) return { t:String(n), u:'秒' };
  return { t: String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0'), u:'' };
};
function setText(el, v){ if(el && el.textContent !== v) el.textContent = v; }
function setHTML(el, v){ if(el && el._h !== v){ el.innerHTML = v; el._h = v; } }

/* ─────────── 音频：提示音走 WebAudio，音乐走 <audio> ─────────── */
let AC = null;
function ac(){
  if(!AC){ try{ AC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }
  return AC;
}
function beep(freq, dur, vol){
  if(!cfg.beep) return;
  const c = ac(); if(!c) return;
  if(c.state === 'suspended'){ try{ c.resume(); }catch(e){} }
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'sine'; o.frequency.value = freq || 880;
  const d = dur || 0.1, v = vol || 0.3;
  g.gain.setValueAtTime(v, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + d);
  o.connect(g); g.connect(c.destination);
  o.start(); o.stop(c.currentTime + d);
}
function buzz(p){ if(cfg.vibrate && navigator.vibrate){ try{ navigator.vibrate(p); }catch(e){} } }

/* 语音 */
function speak(text, rate, interrupt){
  if(!cfg.voice || !('speechSynthesis' in window)) return;
  try{
    if(interrupt && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN'; u.volume = 1; u.rate = rate || 1.2; u.pitch = 1;
    speechSynthesis.speak(u);
  }catch(e){}
}

/* 音乐：<audio> —— iOS 上被 TTS 打断后 pause/play 恢复最可靠 */
const music = () => $('bgm');
let expectPlaying = false;

function musicPlay(){
  const m = music(); if(!m || !m.src) return;
  expectPlaying = true;
  m.loop = true;
  const p = m.play();
  if(p && p.catch) p.catch(()=>{});
}
function musicPause(){
  expectPlaying = false;
  const m = music(); if(m){ try{ m.pause(); }catch(e){} }
}
/* TTS 打断后系统会把 audio 暂停 —— 这里自动接回来 */
function musicHeal(){
  if(!cfg.music || !running || paused) return;
  const m = music();
  if(m && m.src && m.paused) musicPlay();
}

/* 音乐文件存储 */
function idbOpen(){
  return new Promise((res, rej) => {
    const r = indexedDB.open('hb_db2', 1);
    r.onupgradeneeded = () => { try{ r.result.createObjectStore('b'); }catch(e){} };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function blobPut(k, v){
  try{
    const db = await idbOpen();
    await new Promise((res, rej) => {
      const tx = db.transaction('b','readwrite');
      tx.objectStore('b').put(v, k);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  }catch(e){}
}
async function blobGet(k){
  try{
    const db = await idbOpen();
    return await new Promise((res, rej) => {
      const rq = db.transaction('b','readonly').objectStore('b').get(k);
      rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
    });
  }catch(e){ return null; }
}

let curUrl = null;
async function selectTrack(id){
  const t = cfg.tracks.find(x => x.id === id); if(!t) return;
  const blob = await blobGet('m_' + id);
  if(!blob){ $('pTrack').textContent = t.name + '（文件丢失）'; return; }
  const m = music();
  if(curUrl) URL.revokeObjectURL(curUrl);
  curUrl = URL.createObjectURL(blob);
  m.src = curUrl; m.loop = true;
  cfg.trackId = id;
  save(); syncPlayer();
  if(cfg.music && running && !paused) musicPlay();
}
async function addTracks(files){
  for(const f of files){
    const id = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
    await blobPut('m_' + id, f);
    cfg.tracks.push({ id, name:(f.name || '未命名').replace(/\.[^.]+$/, '') });
    if(!cfg.trackId) await selectTrack(id);
  }
  save(); renderMusic(); syncPlayer();
}
async function delTrack(id){
  cfg.tracks = cfg.tracks.filter(x => x.id !== id);
  await blobPut('m_' + id, null);
  if(cfg.trackId === id){
    musicPause(); cfg.trackId = '';
    if(cfg.tracks.length) await selectTrack(cfg.tracks[0].id);
    else { const m = music(); m.removeAttribute('src'); }
  }
  save(); renderMusic(); syncPlayer();
}
function syncPlayer(){
  const t = cfg.tracks.find(x => x.id === cfg.trackId);
  const el = $('pTrack');
  if(el){
    el.textContent = t ? t.name : '未选择音乐';
    el.classList.toggle('on', !!(t && cfg.music));
  }
  const b = $('playMusic');
  if(b){
    b.classList.toggle('on', !!cfg.music);
    b.innerHTML = cfg.music
      ? '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
      : '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  }
}

/* ─────────── 时间线 ─────────── */
let TL = [], idx = 0, remain = 0, endAt = 0, startAt = 0, openEl = 0;
let running = false, paused = false, finished = false, timer = null;

function blockAt(i){ return cfg.blocks[i]; }
function totalSec(){
  let t = cfg.warm + cfg.cool + cfg.prep;
  cfg.blocks.forEach(b => {
    const rounds = b.type === 'time' ? (b.rounds || 1) : 1;
    const work = b.type === 'time' ? (b.work || 0) : 12;
    t += b.sets * rounds * work;
    t += b.sets * Math.max(0, rounds - 1) * (b.rest || 0);
    t += Math.max(0, b.sets - 1) * (b.setRest || 0);
  });
  return Math.round(t);
}

function build(){
  TL = [];
  if(cfg.warm > 0) TL.push({ t:'warm', label:'热身', dur:cfg.warm, c:'#0a84ff' });
  if(cfg.prep > 0) TL.push({ t:'prep', label:'准备', dur:cfg.prep, c:'#ff9f0a' });

  cfg.blocks.forEach((b, bi) => {
    const pk = cfg.pick[bi] || 0;
    const nm = (b.alts && b.alts[pk]) ? b.alts[pk] : b.name;
    const rounds = b.type === 'time' ? (b.rounds || 1) : 1;

    for(let s = 1; s <= b.sets; s++){
      for(let r = 1; r <= rounds; r++){
        TL.push({
          t:'work', label:nm, open: b.type === 'reps',
          dur: b.type === 'time' ? (b.work || 0) : 0,
          set:s, sets:b.sets, round:r, rounds:rounds,
          target: b.target || (b.type === 'time' ? (b.work + ' 秒') : ''),
          c:'#ff9f0a'
        });
        if(r < rounds) TL.push({ t:'rest', label:'休息', dur:b.rest || 0, c:'#30d158', next:nm });
      }
      if(s < b.sets) TL.push({ t:'setrest', label:'组间休息', dur:b.setRest || 0, c:'#30d158', next:nm, nextSet:s+1 });
    }
  });

  if(cfg.cool > 0) TL.push({ t:'cool', label:'放松', dur:cfg.cool, c:'#0a84ff' });
  TL.push({ t:'done', label:'完成', dur:0, c:'#30d158' });
  idx = 0; remain = TL[0] ? TL[0].dur : 0;
}

/* ─────────── 渲染 ─────────── */
function paintInfo(){
  const blocks = cfg.blocks || [];
  setText($('gPlan'), cfg.planName || '自定义');
  setText($('gBlocks'), blocks.length ? (blocks.slice(0,2).map(b=>{
    const pk = cfg.pick[cfg.blocks.indexOf(b)] || 0;
    return (b.alts && b.alts[pk]) ? b.alts[pk] : b.name;
  }).join(' · ') + (blocks.length > 2 ? ' +' + (blocks.length-2) : '')) : '—');
  setText($('gSets'), blocks.length ? blocks.reduce((a,b)=>a+b.sets,0) + ' 组' : '—');
  setText($('gTotal'), fmt(totalSec()));
  setText($('gWarm'), fmt(cfg.warm));
  setText($('gCool'), fmt(cfg.cool));
}

function paint(){
  const idle = (!running && !finished);
  if(idle){
    $('stage') && $('stage').classList && 0;
    document.querySelector('.stage').classList.remove('done');
    setText($('phase'), '准备开始');
    const cd = $('cd');
    setText(cd, fmt(totalSec()));
    if(!cd.classList.contains('small')) cd.classList.add('small');
    cd.style.color = '';
    $('ringFg').setAttribute('stroke', '#30d158');
    $('ringFg').setAttribute('stroke-dashoffset', 289);
    const n = cfg.blocks.length;
    const sets = cfg.blocks.reduce((a,b)=>a+b.sets,0);
    setHTML($('sub'), n ? `<b>${n}</b> 个动作 · 共 <b>${sets}</b> 组` : '还没有动作，点「动作」添加');
    return;
  }

  const seg = TL[idx];
  if(!seg) return;
  document.querySelector('.stage').classList.toggle('done', seg.t === 'done');

  if(seg._l !== seg.label){ seg._l = seg.label; setText($('phase'), seg.label); }
  if(seg._c !== seg.c){
    seg._c = seg.c;
    $('cd').style.color = seg.c;
    $('ringFg').setAttribute('stroke', seg.c);
  }

  setText($('cd'), seg.open ? fmt(openEl) : fmt(seg.t === 'done' ? 0 : remain));
  const small = !seg.open && (seg.t === 'setrest' || seg.t === 'warm' || seg.t === 'cool');
  const cd = $('cd');
  if(cd.classList.contains('small') !== small) cd.classList.toggle('small', small);

  const C = 2 * Math.PI * 46;
  let pct = seg.open ? Math.min(1, openEl/20) : (seg.dur ? Math.max(0, (seg.dur - remain)/seg.dur) : 0);
  $('ringFg').setAttribute('stroke-dashoffset', (C * (1 - pct)).toFixed(1));

  const k = [seg.t, seg.set, seg.round, seg.target, seg.next, seg.nextSet].join('|');
  if(seg._k !== k){
    seg._k = k;
    let s = '';
    if(seg.t === 'work'){
      const parts = [];
      if(seg.sets > 1) parts.push(`第 <b>${seg.set}</b>/${seg.sets} 组`);
      if(seg.rounds > 1) parts.push(`第 <b>${seg.round}</b>/${seg.rounds} 次`);
      if(seg.target) parts.push(`目标 <b>${seg.target}</b>`);
      s = parts.join(' · ');
    } else if(seg.t === 'rest'){
      s = `休息 ${seg.dur} 秒` + (seg.next ? ` · 下一个 <b>${seg.next}</b>` : '');
    } else if(seg.t === 'setrest'){
      s = `组间休息` + (seg.nextSet ? ` · 下一组 <b>${seg.nextSet}</b>/${seg.sets||''}` : '');
    } else if(seg.t === 'warm') s = '热身 · 手指、肩、腕';
    else if(seg.t === 'cool') s = '放松 · 拉伸前臂';
    else if(seg.t === 'prep') s = '准备开始';
    else if(seg.t === 'done') s = '训练完成';
    setHTML($('sub'), s);
  }
  paintBtn();
}

function paintBtn(){
  const b = $('btnPlay'); if(!b) return;
  if(!running){ b.textContent = finished ? '完成' : '开始'; b.className = 'play'; return; }
  if(paused){ b.textContent = '继续'; b.className = 'play pause'; return; }
  const seg = TL[idx];
  if(seg && seg.open){ b.textContent = '完成本组'; b.className = 'play run'; return; }
  b.textContent = '暂停'; b.className = 'play run';
}

/* ─────────── 计时 ─────────── */
const TICK = 200;
function enterSeg(){
  startAt = Date.now(); openEl = 0;
  endAt = startAt + Math.max(0, remain) * 1000;
}
function tick(){
  if(!running || paused) return;
  musicHeal();

  const seg = TL[idx];
  if(seg && seg.open){
    openEl = (Date.now() - startAt) / 1000;
    paint();
    return;
  }

  const left = (endAt - Date.now()) / 1000;
  if(seg && seg.dur >= 6){
    const r = Math.ceil(left);
    if(r > 0 && r <= 3 && r !== seg._b){
      seg._b = r;
      buzz(20);
      if(cfg.voice) speak(String(r), 1.75, false);
      else beep(520, 0.09, 0.34);
    }
  }
  if(left <= 0){ remain = 0; paint(); next(); return; }
  remain = left;
  paint();
}

function next(){
  idx++;
  if(idx >= TL.length){ finish(); return; }
  const seg = TL[idx];
  remain = seg.dur;
  enterSeg();

  // 准点提示音（立即），语音延后
  if(seg.t === 'work'){ beep(880,0.07,0.30); beep(1320,0.07,0.26); buzz([40,60,40]); }
  else if(seg.t === 'rest' || seg.t === 'setrest'){ beep(520,0.10,0.28); buzz(120); }
  else if(seg.t === 'cool' || seg.t === 'done'){ beep(660,0.14,0.30); }
  else { beep(700,0.08,0.22); }

  let say = '';
  if(seg.t === 'work') say = seg.label;
  else if(seg.t === 'rest' || seg.t === 'setrest') say = seg.t === 'setrest' ? '组间休息' : '休息';
  else if(seg.t === 'warm') say = '热身';
  else if(seg.t === 'cool') say = '放松';
  else if(seg.t === 'done') say = '完成';
  if(say) setTimeout(() => speak(say, 1.15, true), 170);

  paint();
}

function finish(){
  running = false; paused = false; finished = true;
  clearInterval(timer);
  [0,180,360,620].forEach((d,i)=>setTimeout(()=>beep(660+i*160,0.16,0.32), d));
  buzz([100,80,100,80,200]);
  speak('训练完成', 1.1, true);
  logSession();
  paint();
  musicPause();
  releaseWake();
}

function start(){
  if(!cfg.blocks.length){ openSheet('blocks'); return; }
  if(finished || !TL.length || idx >= TL.length){
    build(); finished = false; idx = 0; remain = TL[0] ? TL[0].dur : 0;
  }
  running = true; paused = false;
  enterSeg();
  if(cfg.wake) requestWake();
  ac(); if(AC && AC.state === 'suspended'){ try{ AC.resume(); }catch(e){} }
  beep(880, 0.09, 0.3);
  if(cfg.music) musicPlay();
  paint(); paintBtn();
  clearInterval(timer); timer = setInterval(tick, TICK);
}
function toggle(){
  if(!running){ start(); return; }
  if(!paused){
    remain = Math.max(0, (endAt - Date.now()) / 1000);
    paused = true; clearInterval(timer);
    musicPause();
  } else {
    paused = false; enterSeg();
    if(cfg.music) musicPlay();
    clearInterval(timer); timer = setInterval(tick, TICK);
  }
  paintBtn(); paint();
}
function reset(){
  running = false; paused = false; finished = false;
  clearInterval(timer);
  build(); remain = TL[0] ? TL[0].dur : 0;
  musicPause();
  releaseWake();
  paint(); paintBtn();
}
function skip(){
  if(!running){ start(); return; }
  if(paused) { paused = false; clearInterval(timer); timer = setInterval(tick, TICK); }
  next();
}

/* 屏幕常亮 */
let wl = null;
async function requestWake(){ try{ if('wakeLock' in navigator) wl = await navigator.wakeLock.request('screen'); }catch(e){} }
function releaseWake(){ try{ if(wl) wl.release(); }catch(e){} wl = null; }
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'visible'){
    if(running && cfg.wake) requestWake();
    if(running && !paused) tick();
  }
});

/* ─────────── 记录 ─────────── */
function readHist(){
  try{ return JSON.parse(localStorage.getItem(HKEY) || '[]'); }catch(e){ return []; }
}
function logSession(){
  try{
    const h = readHist();
    h.unshift({ d:Date.now(), name:cfg.planName, total:totalSec(),
                blocks: cfg.blocks.map(b => b.alts ? b.alts[cfg.pick[cfg.blocks.indexOf(b)]||0] : b.name) });
    localStorage.setItem(HKEY, JSON.stringify(h.slice(0, 80)));
  }catch(e){}
}
function renderLog(){
  const el = $('logPage'); if(!el) return;
  const h = readHist();
  const now = Date.now();
  const wk = h.filter(x => x.d > now - 7*864e5).length;
  const mo = h.filter(x => x.d > now - 30*864e5).length;
  const mins = Math.round(h.reduce((a,x)=>a+(x.total||0),0)/60);
  const last = h[0] ? Math.floor((now - h[0].d)/864e5) : null;

  el.innerHTML = `
    <div class="grp">
      <h3>统计</h3>
      <div class="stat">
        本周 <b>${wk}</b> 次 ｜ 近 30 天 <b>${mo}</b> 次<br>
        累计 <b>${h.length}</b> 次 · 共 <b>${mins}</b> 分钟<br>
        ${last === null ? '还没有记录' : (last === 0 ? '今天已经练过' : `距上次训练 <b>${last}</b> 天`)}
      </div>
    </div>
    <div class="grp">
      <h3>训练记录</h3>
      ${h.length ? h.map(x => {
        const d = new Date(x.d);
        const ds = `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        return `<div class="hrow"><div class="h1">${x.name}</div>
          <div class="h2">${ds} · ${fmt(x.total)}${x.blocks ? ' · ' + x.blocks.slice(0,3).join(' / ') : ''}</div></div>`;
      }).join('') : '<div class="empty">还没有训练记录</div>'}
    </div>
    ${h.length ? '<button class="btn ghost" id="clearHist">清空记录</button>' : ''}
  `;
  const c = $('clearHist');
  if(c) c.onclick = () => { localStorage.removeItem(HKEY); renderLog(); };
}

/* ─────────── 音乐页 ─────────── */
function renderMusic(){
  const el = $('musicPage'); if(!el) return;
  el.innerHTML = `
    <div class="grp">
      <h3>我的音乐（${cfg.tracks.length}）</h3>
      ${cfg.tracks.length ? cfg.tracks.map(t => `
        <div class="track ${t.id === cfg.trackId ? 'on' : ''}">
          <button class="tp" data-sel="${t.id}">${t.id === cfg.trackId ? '✓' : '▶'}</button>
          <input value="${t.name.replace(/"/g,'&quot;')}" data-nm="${t.id}">
          <button class="tx" data-del="${t.id}">删除</button>
        </div>`).join('') : '<div class="empty">还没有音乐<br><span style="font-size:12px">下面可以添加</span></div>'}
      <label class="filebtn">＋ 添加音乐（可多选）
        <input type="file" id="mfile" accept="audio/*,video/*" multiple hidden>
      </label>
      <div class="note">mp3 / m4a / wav / 视频都行。音量跟随手机音量键，页面不再单独调。</div>
    </div>`;
  const f = $('mfile');
  if(f) f.onchange = async e => { await addTracks([...e.target.files]); e.target.value = ''; };
  el.querySelectorAll('[data-sel]').forEach(b => b.onclick = async () => {
    await selectTrack(b.dataset.sel);
    cfg.music = true; save(); syncPlayer();
    if(running && !paused) musicPlay();
    renderMusic();
  });
  el.querySelectorAll('[data-nm]').forEach(inp => inp.onchange = () => {
    const t = cfg.tracks.find(x => x.id === inp.dataset.nm);
    if(t){ t.name = inp.value.trim() || '未命名'; save(); syncPlayer(); }
  });
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => delTrack(b.dataset.del));
}

/* ─────────── 设置页 ─────────── */
function renderSet(){
  const el = $('setPage'); if(!el) return;
  const sw = (k, lab, sub) => `<div class="row"><div class="lab">${lab}<small>${sub}</small></div>
    <div class="sw ${cfg[k]?'on':''}" data-sw="${k}"></div></div>`;
  el.innerHTML = `
    <div class="grp">
      <h3>提示</h3>
      ${sw('voice','语音播报','念动作名、倒数 3-2-1')}
      ${sw('beep','提示音','阶段切换的短音')}
      ${sw('vibrate','震动','需要手机支持')}
      ${sw('wake','屏幕常亮','训练中不自动锁屏')}
    </div>
    <div class="grp">
      <h3>开与收</h3>
      <div class="row"><div class="lab">热身<small>训练前准备</small></div>
        <div class="stp"><button data-inc="warm" data-d="-1">−</button><div class="v" id="sv_warm">${mmss(cfg.warm).t}<small>${mmss(cfg.warm).u}</small></div><button data-inc="warm" data-d="1">+</button></div></div>
      <div class="row"><div class="lab">放松<small>训练后拉伸</small></div>
        <div class="stp"><button data-inc="cool" data-d="-1">−</button><div class="v" id="sv_cool">${mmss(cfg.cool).t}<small>${mmss(cfg.cool).u}</small></div><button data-inc="cool" data-d="1">+</button></div></div>
      <div class="row"><div class="lab">开始倒数<small>开始前几秒</small></div>
        <div class="stp"><button data-inc="prep" data-d="-1">−</button><div class="v" id="sv_prep">${cfg.prep}<small>秒</small></div><button data-inc="prep" data-d="1">+</button></div></div>
    </div>
    <div class="note">训练计划和动作都在主界面改，这里只管「提示」和「开与收」。</div>`;
  el.querySelectorAll('[data-sw]').forEach(s => s.onclick = () => {
    const k = s.dataset.sw;
    cfg[k] = !cfg[k]; s.classList.toggle('on', cfg[k]);
    save();
    if(k === 'music'){ /* 音乐开关在主界面 */ }
    if(k === 'voice' && cfg.voice) speak('语音已开启', 1.1, true);
  });
  el.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => {
    const k = b.dataset.inc, d = +b.dataset.d;
    const step = k === 'prep' ? 1 : 30;
    const mn = k === 'prep' ? 0 : 0, mx = k === 'prep' ? 15 : 900;
    cfg[k] = Math.min(mx, Math.max(mn, cfg[k] + d*step));
    save();
    const el2 = $('sv_' + k);
    if(el2) el2.innerHTML = k === 'prep' ? cfg[k] + '<small>秒</small>'
                                         : mmss(cfg[k]).t + '<small>' + mmss(cfg[k]).u + '</small>';
    if(!running) reset();
    paintInfo();
  });
}

/* ─────────── 底部面板 ─────────── */
function openSheet(kind){
  const t = $('shTitle'), b = $('shBody');
  if(kind === 'plan'){
    t.textContent = '训练计划';
    b.innerHTML = Object.entries(PLANS).map(([k,p]) => `
      <div class="pickrow ${cfg.planId===k?'on':''}" data-plan="${k}">
        <span class="pn">${p.name}</span>
        <span class="pd">${p.blocks.length ? p.blocks.map(x=>x.name).join(' · ').slice(0,18) : '自己搭'}</span>
      </div>`).join('');
    b.querySelectorAll('[data-plan]').forEach(r => r.onclick = () => {
      const k = r.dataset.plan, p = PLANS[k];
      cfg.planId = k; cfg.planName = p.name;
      cfg.blocks = JSON.parse(JSON.stringify(p.blocks));
      cfg.pick = {};
      running = false; finished = false; clearInterval(timer);
      build(); remain = TL[0] ? TL[0].dur : 0;
      save(); paintInfo(); paint(); paintBtn();
      closeSheet();
    });
  }

  else if(kind === 'blocks'){
    t.textContent = '动作设置';
    b.innerHTML = (cfg.blocks.length ? cfg.blocks.map((bl, i) => {
      const pk = cfg.pick[i] || 0;
      const isTime = bl.type === 'time';
      const sel = bl.alts ? `<select class="sel" data-alt="${i}">${
        bl.alts.map((n,j)=>`<option value="${j}" ${j===pk?'selected':''}>${n}</option>`).join('')}</select>` : '';
      return `<div class="blk">
        <div class="blk-top">
          <span class="blk-no">${i+1}</span>
          <input class="blk-name" value="${bl.name}" data-bn="${i}">
          <span class="blk-x" data-bd="${i}">✕</span>
        </div>
        ${sel}
        <div class="blk-row">
          ${isTime ? `<span class="lb">时长</span><div class="stp"><button data-bf="${i}|work" data-d="-1">−</button><div class="v">${bl.work||0}<small>秒</small></div><button data-bf="${i}|work" data-d="1">+</button></div>` : `<span class="lb">计次</span>`}
          ${isTime ? `<span class="lb">次/组</span><div class="stp"><button data-bf="${i}|rounds" data-d="-1">−</button><div class="v">${bl.rounds||1}</div><button data-bf="${i}|rounds" data-d="1">+</button></div>` : ''}
          ${isTime && (bl.rounds||1) > 1 ? `<span class="lb">次间休</span><div class="stp"><button data-bf="${i}|rest" data-d="-1">−</button><div class="v">${bl.rest||0}<small>秒</small></div><button data-bf="${i}|rest" data-d="1">+</button></div>` : ''}
        </div>
        <div class="blk-row">
          <span class="lb">组数</span><div class="stp"><button data-bf="${i}|sets" data-d="-1">−</button><div class="v">${bl.sets}</div><button data-bf="${i}|sets" data-d="1">+</button></div>
          <span class="lb">组间休</span><div class="stp"><button data-bf="${i}|setRest" data-d="-1">−</button><div class="v">${bl.setRest||0}<small>秒</small></div><button data-bf="${i}|setRest" data-d="1">+</button></div>
        </div>
      </div>`;
    }).join('') : '<div class="empty">还没有动作</div>')
    + `<button class="btn ghost" id="addBlk">＋ 添加动作</button>
       <button class="btn pri" id="doneBlk" style="margin:14px 0 4px">完成</button>`;

    b.querySelectorAll('[data-bn]').forEach(inp => inp.onchange = () => {
      cfg.blocks[+inp.dataset.bn].name = inp.value.trim() || '动作';
      changed();
    });
    b.querySelectorAll('[data-alt]').forEach(s => s.onchange = () => {
      cfg.pick[+s.dataset.alt] = +s.value;
      cfg.blocks[+s.dataset.alt].name = cfg.blocks[+s.dataset.alt].alts[+s.value];
      changed();
    });
    b.querySelectorAll('[data-bd]').forEach(x => x.onclick = () => {
      cfg.blocks.splice(+x.dataset.bd, 1);
      cfg.pick = {};
      changed(); openSheet('blocks');
    });
    b.querySelectorAll('[data-bf]').forEach(x => x.onclick = () => {
      const [i, f] = x.dataset.bf.split('|');
      const bl = cfg.blocks[+i];
      const d = +x.dataset.d;
      const lim = { work:[1,60,1], rounds:[1,20,1], rest:[1,120,1], sets:[1,15,1], setRest:[10,600,10] }[f];
      bl[f] = Math.min(lim[1], Math.max(lim[0], (bl[f]||lim[0]) + d*lim[2]));
      if(f === 'rounds' && bl.rounds < 2 && !bl.rest) bl.rest = 3;
      changed(); openSheet('blocks');
    });
    const add = $('addBlk');
    if(add) add.onclick = () => {
      cfg.blocks.push({ name:'新动作', type:'time', work:10, target:'10 秒', rounds:1, rest:0, sets:3, setRest:60 });
      cfg.pick = {}; changed(); openSheet('blocks');
    };
    const dn = $('doneBlk');
    if(dn) dn.onclick = closeSheet;
  }

  else if(kind === 'sets' || kind === 'warm' || kind === 'cool' || kind === 'total'){
    openSheet(kind === 'total' ? 'blocks' : kind === 'sets' ? 'blocks' : kind);
  }

  $('mask').classList.add('on');
  $('sheet').classList.add('on');
}

function changed(){
  running = false; finished = false; clearInterval(timer);
  build(); remain = TL[0] ? TL[0].dur : 0;
  save(); paintInfo(); paint(); paintBtn();
}
function closeSheet(){
  $('mask').classList.remove('on');
  $('sheet').classList.remove('on');
}

/* ─────────── 页面切换 ─────────── */
let tab = 'timer';
function switchTab(t){
  tab = t;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'view-' + t));
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  if(t === 'music') renderMusic();
  if(t === 'log') renderLog();
  if(t === 'set') renderSet();
}

/* ─────────── 启动 ─────────── */
load();
build();
remain = TL[0] ? TL[0].dur : 0;

document.querySelectorAll('.tabbar button').forEach(b => b.onclick = () => switchTab(b.dataset.tab));
document.querySelectorAll('.cell[data-q]').forEach(c => c.onclick = () => openSheet(c.dataset.q));
$('shClose').onclick = closeSheet;
$('mask').onclick = closeSheet;
$('btnPlay').onclick = () => {
  const seg = TL[idx];
  if(running && !paused && seg && seg.open){ skip(); return; }
  toggle();
};
$('btnReset').onclick = reset;
$('btnSkip').onclick = skip;

$('playMusic').onclick = () => {
  if(!cfg.trackId){ switchTab('music'); return; }
  cfg.music = !cfg.music; save();
  if(cfg.music){ musicPlay(); } else { musicPause(); }
  syncPlayer();
};
$('nextTrack').onclick = () => cycleTrack(1);
$('prevTrack').onclick = () => cycleTrack(-1);
function cycleTrack(dir){
  if(cfg.tracks.length < 2){ switchTab('music'); return; }
  const i = cfg.tracks.findIndex(t => t.id === cfg.trackId);
  const nx = cfg.tracks[(i + dir + cfg.tracks.length) % cfg.tracks.length];
  selectTrack(nx.id).then(() => {
    cfg.music = true; save(); syncPlayer();
    if(running && !paused) musicPlay();
  });
}

$('bgm').addEventListener('pause', () => {
  if(expectPlaying && cfg.music && running && !paused){
    setTimeout(() => { if(cfg.music && running && !paused && $('bgm').paused) musicPlay(); }, 260);
  }
});

document.addEventListener('keydown', e => {
  if(e.code === 'Space'){ e.preventDefault(); toggle(); }
  if(e.code === 'KeyR') reset();
  if(e.code === 'ArrowRight') skip();
});
document.addEventListener('gesturestart', e => e.preventDefault());

(async () => {
  if(cfg.trackId) await selectTrack(cfg.trackId);
  paintInfo(); paint(); paintBtn(); syncPlayer();
})();
