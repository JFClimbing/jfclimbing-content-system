/* 指力训练计时器 · Hangboard Timer */
'use strict';

const PRESETS = {
  // ═══ 指力板 ═══
  fbo: {
    name:'指力板 · 开握 7:50',
    work:7, rest:50, reps:6, sets:3, setRest:120, warm:300, cool:180,
    ex:['开握悬挂']
  },
  fbh: {
    name:'指力板 · 半抠 5:55',
    work:5, rest:55, reps:5, sets:3, setRest:120, warm:300, cool:180,
    ex:['半抠悬挂']
  },
  fbm: {
    name:'指力板 · 开握+半抠轮换',
    work:7, rest:50, reps:6, sets:3, setRest:120, warm:300, cool:180,
    ex:['开握悬挂','半抠悬挂']
  },
  // ═══ 手臂 + 背部（循环） ═══
  arm: {
    name:'手臂 + 背部（循环）',
    work:45, rest:60, reps:5, sets:3, setRest:120, warm:300, cool:180,
    ex:['引体向上','俯卧撑','澳式划船','小臂静态弯举','平板支撑']
  },
  // ═══ 自定义 ═══
  custom: {
    name:'自定义',
    work:7, rest:50, reps:6, sets:3, setRest:120, warm:300, cool:180
  }
};

const DEF_EX = ['开握悬挂'];
const KEY = 'hb_cfg_v1', HKEY = 'hb_hist_v1';

let cfg = {
  preset:'fbo', name:'指力板 · 开握 7:50',
  work:7, rest:50, reps:6, sets:3, setRest:120, warm:300, cool:180,
  prep:5,
  exercises: ['开握悬挂'],
  beep:true, vibrate:true, wake:true,
  voice:true,            // 语音倒数 / 阶段播报
  music:false,           // 背景音乐
  musicVol:0.35,         // 音乐音量（0–1）
  musicName:''
};

function loadCfg(){
  try{ const s = JSON.parse(localStorage.getItem(KEY)); if(s) Object.assign(cfg, s); }catch(e){}
}
function saveCfg(){ try{ localStorage.setItem(KEY, JSON.stringify(cfg)); }catch(e){} }

const $ = id => document.getElementById(id);
function fmt(s){
  s = Math.max(0, Math.ceil(s));
  const m = Math.floor(s/60), r = s%60;
  return String(m).padStart(2,'0') + ':' + String(r).padStart(2,'0');
}
function timeLabel(v){
  const n = Math.round(v);
  if(n < 60) return { t: String(n), u: '秒' };
  const m = Math.floor(n/60), r = n%60;
  return { t: String(m).padStart(2,'0') + ':' + String(r).padStart(2,'0'), u: '' };
}
function mins(s){ return s>=60 ? Math.floor(s/60)+'分' : s+'秒'; }

/* ── 音效 ── */
let AC = null;
function ac(){
  if(!AC){ try{ AC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }
  return AC;
}
function beep(freq, dur, vol){
  if(!cfg.beep) return;
  const c = ac(); if(!c) return;
  if(c.state === 'suspended') c.resume();
  freq = freq || 880; dur = dur || 0.12; vol = vol || 0.3;
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g); g.connect(c.destination);
  o.start(); o.stop(c.currentTime + dur);
}
function triple(){ [0,140,280].forEach((d,i)=>setTimeout(()=>beep(660+i*220,0.11),d)); }
function buzz(p){ if(cfg.vibrate && navigator.vibrate) try{ navigator.vibrate(p); }catch(e){} }

/* ── 语音播报（倒数 / 阶段提示） ── */
function speak(text, rate){
  if(!cfg.voice) return;
  if(!('speechSynthesis' in window)) return;
  try{
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.volume = 1;            // 系统音量上限
    u.rate = rate || 1.15;
    u.pitch = 1;
    speechSynthesis.speak(u);
    duck(1100);              // 说话时压住音乐
  }catch(e){}
}

/* 预热语音引擎（iOS 需要一次用户手势激活；voices 列表是异步的） */
function warmSpeech(){
  try{
    if(!('speechSynthesis' in window)) return;
    speechSynthesis.getVoices();
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0; u.lang = 'zh-CN';
    speechSynthesis.speak(u);
  }catch(e){}
}
if('speechSynthesis' in window){
  speechSynthesis.onvoiceschanged = () => { try{ speechSynthesis.getVoices(); }catch(e){} };
}

/* ── 背景音乐（走 Web Audio GainNode，iOS 上才真能调音量） ── */
let bgmEl = null;
let duckTimer = null;
let musicSrcNode = null;
let musicGain = null;
let musicBuf = null;          // 解码后的音频（null = 用 <video> 兜底）

function bgm(){ if(!bgmEl) bgmEl = document.getElementById('bgm'); return bgmEl; }
function gainNode(){
  const ctx = ac(); if(!ctx) return null;
  if(!musicGain){ musicGain = ctx.createGain(); musicGain.gain.value = cfg.musicVol; }
  return musicGain;
}
function applyVol(v){
  if(musicGain) musicGain.gain.value = v;
  const m = bgm();
  if(m && !musicBuf) { try{ m.volume = v; }catch(e){} }   // 兜底路径（iOS 无效，其他平台有效）
}
function musicStart(){
  if(!cfg.music) return;
  const ctx = ac(); if(!ctx) return;
  if(ctx.state === 'suspended') ctx.resume();
  if(musicBuf){
    try{ if(musicSrcNode){ musicSrcNode.stop(); musicSrcNode.disconnect(); } }catch(e){}
    const g = gainNode(); g.gain.value = cfg.musicVol;
    musicSrcNode = ctx.createBufferSource();
    musicSrcNode.buffer = musicBuf;
    musicSrcNode.loop = true;
    musicSrcNode.connect(g);
    g.connect(ctx.destination);
    musicSrcNode.start();
  } else {
    const m = bgm(); if(!m || !m.src) return;
    m.loop = true;
    const pr = m.play(); if(pr && pr.catch) pr.catch(()=>{});
  }
}
function musicStop(){
  try{ if(musicSrcNode){ musicSrcNode.stop(); musicSrcNode.disconnect(); musicSrcNode = null; } }catch(e){}
  const m = bgm(); if(m) try{ m.pause(); }catch(e){}
}
function musicSetVolume(v){
  cfg.musicVol = Math.max(0, Math.min(1, v));
  applyVol(cfg.musicVol);
  saveCfg();
}
/* 播报/提示音时把音乐压到 15%，随后恢复 */
function duck(ms){
  if(!cfg.music) return;
  applyVol(Math.max(0.01, cfg.musicVol * 0.15));
  clearTimeout(duckTimer);
  duckTimer = setTimeout(() => { duckTimer = null; applyVol(cfg.musicVol); }, ms || 1200);
}

/* ── 音乐文件存取（IndexedDB，刷新后还在） ── */
function idbOpen(){
  return new Promise((res, rej) => {
    const r = indexedDB.open('hb_db', 1);
    r.onupgradeneeded = () => { try{ r.result.createObjectStore('blobs'); }catch(e){} };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbPut(k, v){
  try{
    const db = await idbOpen();
    await new Promise((res, rej) => {
      const tx = db.transaction('blobs', 'readwrite');
      tx.objectStore('blobs').put(v, k);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }catch(e){}
}
async function idbGet(k){
  try{
    const db = await idbOpen();
    return await new Promise((res, rej) => {
      const tx = db.transaction('blobs', 'readonly');
      const rq = tx.objectStore('blobs').get(k);
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
  }catch(e){ return null; }
}
async function loadMusicFile(file){
  if(!file) return;
  cfg.musicName = file.name;
  cfg.music = true;
  await idbPut('music', file);
  const ctx = ac();
  let ok = false;
  if(ctx && file.type && file.type.indexOf('audio') === 0){
    try{
      const ab = await file.arrayBuffer();
      musicBuf = await new Promise((res, rej) => {
        try{ ctx.decodeAudioData(ab.slice(0), res, rej); }catch(e){ rej(e); }
      });
      ok = !!musicBuf;
    }catch(e){ ok = false; }
  }
  if(!ok){
    musicBuf = null;
    const m = bgm();
    if(m && m.src && m.src.indexOf('blob:') === 0) URL.revokeObjectURL(m.src);
    m.src = URL.createObjectURL(file);
    m.loop = true;
  }
  saveCfg();
  if(running && !paused) musicStart();
  renderDrawer();
}
async function restoreMusic(){
  const blob = await idbGet('music');
  if(!blob) return;
  const ctx = ac();
  if(blob.type && blob.type.indexOf('audio') === 0 && ctx){
    try{
      const ab = await blob.arrayBuffer();
      musicBuf = await new Promise((res, rej) => {
        try{ ctx.decodeAudioData(ab.slice(0), res, rej); }catch(e){ rej(e); }
      });
    }catch(e){ musicBuf = null; }
  }
  if(!musicBuf){
    const m = bgm();
    if(m) { m.src = URL.createObjectURL(blob); m.loop = true; }
  }
  if(!cfg.musicName) cfg.musicName = '已保存的音乐';
  if(typeof renderDrawer === 'function' && document.getElementById('dbody').innerHTML) renderDrawer();
}

/* ── 阶段播报文本 ── */
function phaseSpeech(seg){
  if(!seg) return '';
  if(seg.type === 'work'){
    return (seg.ex && seg.ex.length <= 8) ? seg.ex : '开始';
  }
  if(seg.type === 'rest') return '休息';
  if(seg.type === 'setrest') return '下一组';
  if(seg.type === 'warm') return '热身开始';
  if(seg.type === 'cool') return '放松';
  if(seg.type === 'done') return '训练完成';
  if(seg.type === 'prep') return '准备';
  return '';
}


/* ── 时间线 ── */
let TL = [], idx = 0, remain = 0, running = false, paused = false, finished = false;
let segEndAt = 0;          // 当前阶段的绝对结束时刻（performance.now 基准）
let ticker = null;         // setInterval 句柄
const TICK_MS = 200;       // 刷新频率（被节流也能靠绝对时间校准）

function exerciseAt(i){
  const ex = (cfg.exercises && cfg.exercises.length) ? cfg.exercises : [''];
  return ex[i % ex.length];
}
function buildTimeline(){
  TL = [];
  if(cfg.warm > 0) TL.push({ type:'warm', label:'热身', dur:cfg.warm, color:'--blue' });
  if(cfg.prep > 0) TL.push({ type:'prep', label:'准备', dur:cfg.prep, color:'--orange' });
  let rep = 0;
  for(let s=1; s<=cfg.sets; s++){
    for(let r=1; r<=cfg.reps; r++){
      TL.push({ type:'work', label:'悬挂', dur:cfg.work, color:'--orange',
                set:s, rep:r, ex:exerciseAt(rep) });
      rep++;
      if(r < cfg.reps) TL.push({ type:'rest', label:'间隔休息', dur:cfg.rest, color:'--green', set:s, rep:r });
    }
    if(s < cfg.sets) TL.push({ type:'setrest', label:'组间休息', dur:cfg.setRest, color:'--green', nextSet:s+1 });
  }
  if(cfg.cool > 0) TL.push({ type:'cool', label:'放松', dur:cfg.cool, color:'--blue' });
  TL.push({ type:'done', label:'完成', dur:0, color:'--green' });
  idx = 0; remain = TL[0] ? TL[0].dur : 0;
}
function totalSec(){
  return cfg.sets*cfg.reps*cfg.work
       + cfg.sets*(cfg.reps-1)*cfg.rest
       + Math.max(0, cfg.sets-1)*cfg.setRest
       + cfg.warm + cfg.cool + cfg.prep;
}

/* ── 渲染 ── */
function paintInfo(){
  const ex = (cfg.exercises && cfg.exercises.length) ? cfg.exercises.filter(Boolean) : ['—'];
  if(!ex.length) ex.push('—');
  $('gEx').innerHTML = ex.slice(0,2).join(' · ') + (ex.length>2 ? ` <span style="color:var(--muted)">+${ex.length-2}</span>` : '');
  $('gSetRest').textContent = fmt(cfg.setRest);
  $('gReps').textContent = cfg.sets + ' 组 × ' + cfg.reps + ' 次';
  $('gTotal').textContent = fmt(totalSec());
  $('gWarm').textContent = fmt(cfg.warm);
  $('gCool').textContent = fmt(cfg.cool);
}
function paintStage(){
  const idle = (!running && !finished && idx === 0);
  if(idle){
    const stage0 = $('stage');
    stage0.classList.remove('done');
    $('phase').textContent = '准备开始';
    $('cd').textContent = fmt(totalSec());
    $('cd').classList.add('small');
    $('cd').style.color = '';
    $('ringFg').setAttribute('stroke', '#30d158');
    $('ringFg').setAttribute('stroke-dasharray', 289);
    $('ringFg').setAttribute('stroke-dashoffset', 289);
    $('sub').innerHTML = `共 <b>${cfg.sets}</b> 组 × <b>${cfg.reps}</b> 次 · 每次 <b>${cfg.work}</b> 秒`;
    return;
  }
  const seg = TL[idx], stage = $('stage');
  stage.classList.toggle('done', !!seg && seg.type === 'done');
  if(!seg){ $('phase').textContent = '准备开始'; $('cd').textContent = fmt(0); $('sub').textContent = ''; return; }
  $('phase').textContent = seg.label;
  $('cd').textContent = fmt(seg.type === 'done' ? 0 : remain);
  $('cd').classList.toggle('small', seg.type==='setrest' || seg.type==='warm' || seg.type==='cool');
  const col = getComputedStyle(document.documentElement).getPropertyValue(seg.color || '--orange').trim();
  $('cd').style.color = col || '#ff9f0a';
  $('ringFg').setAttribute('stroke', col || '#ff9f0a');
  const C = 2 * Math.PI * 46;
  const pct = seg.dur ? Math.max(0, (seg.dur - remain) / seg.dur) : 1;
  $('ringFg').setAttribute('stroke-dasharray', C);
  $('ringFg').setAttribute('stroke-dashoffset', C * (1 - pct));

  let sub = '';
  if(seg.type === 'work') sub = `第 <b>${seg.set}</b>/${cfg.sets} 组 · 第 <b>${seg.rep}</b>/${cfg.reps} 次` + (seg.ex ? ` · <b>${seg.ex}</b>` : '');
  else if(seg.type === 'rest') sub = `第 <b>${seg.set}</b>/${cfg.sets} 组 · 休息 ${mins(cfg.rest)}`;
  else if(seg.type === 'setrest') sub = `下一组：第 <b>${seg.nextSet}</b>/${cfg.sets} 组`;
  else if(seg.type === 'warm') sub = '热身 · 手指、肩、腕';
  else if(seg.type === 'cool') sub = '放松 · 拉伸前臂';
  else if(seg.type === 'prep') sub = '准备开始';
  else if(seg.type === 'done') sub = '训练完成';
  $('sub').innerHTML = sub;
}

/* ── 计时（绝对时间戳驱动，后台/锁屏也不跑偏） ── */
function tick(){
  if(!running || paused) return;
  const now = performance.now();
  const left = (segEndAt - now) / 1000;

  // 最后 3 秒提示音
  const seg = TL[idx];
  if(seg && seg.type !== 'done'){
    const r = Math.ceil(left);
    if(r > 0 && r <= 3 && r !== seg._lastBeep){
      seg._lastBeep = r;
      beep(520, 0.08, 0.30); buzz(20);
      speak(String(r), 1.4);          // 倒数：三 / 二 / 一
    }
  }

  if(left <= 0){ remain = 0; paintStage(); next(); return; }
  remain = left;
  paintStage();
}
function startTicker(){ stopTicker(); ticker = setInterval(tick, TICK_MS); }
function stopTicker(){ if(ticker){ clearInterval(ticker); ticker = null; } }

function enterSegment(){
  // 以当前 remain 为基准，算出绝对结束时刻
  segEndAt = performance.now() + Math.max(0, remain) * 1000;
}
function next(){
  idx++;
  if(idx >= TL.length){ finish(); return; }
  remain = TL[idx].dur;
  enterSegment();
  const type = TL[idx].type;
  if(type === 'work'){ triple(); buzz([40,60,40]); }
  else if(type === 'rest' || type === 'setrest'){ beep(440,0.16,0.3); buzz(120); }
  else if(type === 'cool' || type === 'done'){ beep(660,0.2,0.3); }
  else { beep(600,0.1,0.2); }
  const say = phaseSpeech(TL[idx]);
  if(say) setTimeout(() => speak(say), 120);
  paintStage();
}
function finish(){
  running = false; paused = false; finished = true;
  stopTicker();
  $('btnPlay').textContent = '完成';
  $('btnPlay').className = 'play';
  [0,200,400,700].forEach((d,i)=>setTimeout(()=>beep(660+i*160,0.18,0.35),d));
  buzz([100,80,100,80,200]);
  logSession();
  paintStage();
  musicStop();
  releaseWake();
  if(cfg.notify && 'Notification' in window && Notification.permission === 'granted'){
    try{ new Notification('指力训练完成', { body: `共 ${cfg.sets} 组 × ${cfg.reps} 次` }); }catch(e){}
  }
}

/* ── 控制 ── */
function start(){
  if(finished || !TL.length || idx >= TL.length){
    buildTimeline(); finished = false; idx = 0; remain = TL[0] ? TL[0].dur : 0;
  }
  running = true; paused = false;
  enterSegment();
  $('btnPlay').textContent = '暂停'; $('btnPlay').className = 'play run';
  if(cfg.wake) requestWake();
  ac(); beep(880,0.1,0.3);
  warmSpeech();
  musicStart();
  paintStage();
  startTicker();
}
function togglePause(){
  if(!running) return start();
  if(!paused){
    // 暂停：先结算当前剩余
    remain = Math.max(0, (segEndAt - performance.now()) / 1000);
    paused = true; stopTicker(); musicStop();
    $('btnPlay').textContent = '继续'; $('btnPlay').className = 'play pause';
    paintStage();
  } else {
    paused = false; enterSegment();
    musicStart();
    $('btnPlay').textContent = '暂停'; $('btnPlay').className = 'play run';
    startTicker();
    paintStage();
  }
}
function reset(){
  running = false; paused = false; finished = false;
  stopTicker();
  buildTimeline(); remain = TL[0] ? TL[0].dur : 0;
  $('btnPlay').textContent = '开始'; $('btnPlay').className = 'play';
  musicStop();
  paintStage(); releaseWake();
}
function skip(){
  if(!running){ start(); return; }
  const wasPaused = paused;
  if(wasPaused){ paused = false; }
  next();
  if(wasPaused){
    $('btnPlay').textContent = '暂停';
    $('btnPlay').className = 'play run';
    startTicker();
  }
}

// 从后台切回来时，立即校准一次（绝对时间戳保证不错）
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'visible' && running && !paused){
    tick();
    if(cfg.wake) requestWake();
  }
});

/* ── 屏幕常亮 ── */
let wakeLock = null;
async function requestWake(){
  try{ if('wakeLock' in navigator){ wakeLock = await navigator.wakeLock.request('screen'); } }catch(e){}
}
function releaseWake(){ try{ if(wakeLock) wakeLock.release(); }catch(e){} wakeLock = null; }


/* ── 记录 ── */
function logSession(){
  try{
    const h = JSON.parse(localStorage.getItem(HKEY) || '[]');
    h.unshift({ d: Date.now(), total: totalSec(), sets: cfg.sets, reps: cfg.reps,
                work: cfg.work, name: cfg.name, ex: cfg.exercises.join('·') });
    localStorage.setItem(HKEY, JSON.stringify(h.slice(0, 60)));
  }catch(e){}
}

/* ── 设置抽屉 ── */
const LIMITS = { work:[1,60,1], rest:[1,120,1], reps:[1,20,1], sets:[1,12,1],
                 setRest:[10,600,10], warm:[0,900,30], cool:[0,900,30], prep:[0,15,1] };
const TIMEK = ['work','rest','setRest','warm','cool','prep'];

function stepper(key, label, sub, unit){
  const v = cfg[key], isT = TIMEK.includes(key);
  const d = isT ? timeLabel(v) : { t: String(v), u: unit };
  return `<div class="row">
    <div class="lab">${label}${sub ? `<small>${sub}</small>` : ''}</div>
    <div class="stepper">
      <button data-dec="${key}">−</button>
      <div class="num" id="num_${key}">${d.t}<small>${d.u}</small></div>
      <button data-inc="${key}">+</button>
    </div>
  </div>`;
}
function renderDrawer(){
  const d = $('dbody');
  d.innerHTML = `
    <div class="group">
      <h3>训练法</h3>
      <div class="chipbar" id="chipPreset">
        ${Object.entries(PRESETS).map(([k,p]) => `<div class="chip ${cfg.preset===k?'on':''}" data-p="${k}">${p.name}</div>`).join('')}
      </div>
    </div>

    <div class="group">
      <h3>时长参数</h3>
      ${stepper('work','单次悬挂','每次挂住的时长','秒')}
      ${stepper('rest','间隔休息','两次悬挂之间','秒')}
      ${stepper('reps','循环次数','每组悬挂几次','次')}
      ${stepper('sets','组数','整个训练做几组','组')}
      ${stepper('setRest','组间休息','两组之间','秒')}
    </div>

    <div class="group">
      <h3>开与收</h3>
      ${stepper('warm','开始热身','手指/肩/腕预热','秒')}
      ${stepper('cool','结尾放松','拉伸前臂','秒')}
      ${stepper('prep','开始倒数','开始前倒数几秒','秒')}
    </div>

    <div class="group">
      <h3>动作列表（循环使用）</h3>
      <div class="exlist" id="exlist">
        ${cfg.exercises.map((e,i) => `<div class="exitem">
            <input value="${e.replace(/"/g,'&quot;')}" data-ex="${i}" placeholder="动作名">
            <span class="del" data-del="${i}">✕</span>
          </div>`).join('')}
      </div>
      <div class="chipbar" style="margin-top:10px">
        <div class="chip x" id="addEx">＋ 添加动作</div>
      </div>
    </div>

    <div class="group">
      <h3>语音播报</h3>
      <div class="row"><div class="lab">语音倒数<small>最后 3 秒报「三、二、一」，并朗读阶段</small></div>
        <div class="switch ${cfg.voice?'on':''}" data-sw="voice"></div></div>
      <div class="row"><div class="lab">提示音<small>阶段切换的提示音</small></div>
        <div class="switch ${cfg.beep?'on':''}" data-sw="beep"></div></div>
      <div class="row"><div class="lab">震动<small>需要手机支持</small></div>
        <div class="switch ${cfg.vibrate?'on':''}" data-sw="vibrate"></div></div>
      <div class="row"><div class="lab">屏幕常亮<small>训练中不自动锁屏</small></div>
        <div class="switch ${cfg.wake?'on':''}" data-sw="wake"></div></div>
    </div>

    <div class="group">
      <h3>背景音乐</h3>
      <div class="row"><div class="lab">播放音乐<small>${cfg.musicName ? '当前：' + cfg.musicName : '还没选文件'}</small></div>
        <div class="switch ${cfg.music?'on':''}" data-sw="music"></div></div>
      <div class="row"><div class="lab">音量<small>播报时自动压低，不会盖住倒数</small></div>
        <div class="volwrap">
          <input type="range" id="volRange" min="0" max="100" value="${Math.round(cfg.musicVol*100)}">
          <span id="volVal">${Math.round(cfg.musicVol*100)}%</span>
        </div>
      </div>
      <div class="row"><div class="lab">选择文件<small>音频或视频都行，视频会自动只播声音</small></div>
        <label class="filebtn">选取<input type="file" id="musicFile" accept="audio/*,video/*" hidden></label>
      </div>
      ${cfg.musicName ? '<div class="row"><div class="lab">操作</div><button class="minibtn" id="playMusicTest">试听</button><button class="minibtn" id="delMusic">删除</button></div>' : ''}
    </div>

    <div class="group">
      <h3>最近训练</h3>
      <div class="hist" id="hist"></div>
    </div>

    <button class="btn pri" id="btnApply">完成</button>
    <button class="btn ghost" id="btnClearHist">清空训练记录</button>
    <div style="height:20px"></div>
  `;
  renderHist();
  bindDrawer();
}
function renderHist(){
  const el = $('hist'); if(!el) return;
  let h = [];
  try{ h = JSON.parse(localStorage.getItem(HKEY) || '[]'); }catch(e){}
  if(!h.length){ el.innerHTML = '<div class="empty">还没有训练记录</div>'; return; }
  el.innerHTML = h.slice(0,8).map(x => {
    const d = new Date(x.d);
    const ds = `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    return `<div>${ds} · <b>${x.name}</b> · ${x.sets}×${x.reps}×${x.work}s · 共 ${fmt(x.total)}</div>`;
  }).join('');
}
function bindDrawer(){
  const d = $('dbody');
  d.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => bump(b.dataset.inc, 1));
  d.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => bump(b.dataset.dec, -1));
  d.querySelectorAll('[data-p]').forEach(c => c.onclick = () => {
    const k = c.dataset.p, p = PRESETS[k];
    Object.assign(cfg, { preset:k, name:p.name, work:p.work, rest:p.rest, reps:p.reps,
                         sets:p.sets, setRest:p.setRest, warm:p.warm, cool:p.cool });
    if(p.ex) cfg.exercises = p.ex.slice();
    saveCfg(); renderDrawer(); renderPreset(); reset(); paintInfo();
  });
  d.querySelectorAll('[data-sw]').forEach(s => s.onclick = () => {
    const k = s.dataset.sw;
    cfg[k] = !cfg[k];
    s.classList.toggle('on', cfg[k]);
    saveCfg();
    if(k === 'music'){
      if(cfg.music){ musicStart(); }
      else { musicStop(); }
    }
    if(k === 'voice' && cfg.voice){ speak('语音已开启', 1.1); }
  });
  d.querySelectorAll('[data-ex]').forEach(inp => inp.oninput = () => {
    cfg.exercises[+inp.dataset.ex] = inp.value; saveCfg(); paintInfo();
  });
  d.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    cfg.exercises.splice(+b.dataset.del, 1);
    if(!cfg.exercises.length) cfg.exercises = [''];
    saveCfg(); renderDrawer(); paintInfo();
  });
  const add = $('addEx');
  if(add) add.onclick = () => { cfg.exercises.push('新动作'); saveCfg(); renderDrawer(); paintInfo(); };

  // 音乐音量
  const vr = $('volRange');
  if(vr) vr.oninput = () => {
    musicSetVolume(vr.value / 100);
    const v = $('volVal'); if(v) v.textContent = vr.value + '%';
  };
  // 选文件
  const mf = $('musicFile');
  if(mf) mf.onchange = async e => {
    const f = e.target.files && e.target.files[0];
    if(f) await loadMusicFile(f);
  };
  const pt = $('playMusicTest');
  if(pt) pt.onclick = () => { cfg.music = true; saveCfg(); musicStart(); setTimeout(()=>duck(600), 50); };
  const dm = $('delMusic');
  if(dm) dm.onclick = async () => {
    musicStop();
    const m = bgm(); if(m) m.removeAttribute('src');
    cfg.music = false; cfg.musicName = ''; saveCfg();
    await idbPut('music', null);
    renderDrawer();
  };
  $('btnApply').onclick = closeDrawer;
  $('btnClearHist').onclick = () => { localStorage.removeItem(HKEY); renderHist(); };
}
function bump(key, dir){
  const [mn, mx, step] = LIMITS[key];
  cfg[key] = Math.min(mx, Math.max(mn, cfg[key] + dir*step));
  cfg.preset = 'custom'; cfg.name = '自定义';
  const el = $('num_' + key);
  if(el){
    const isT = TIMEK.includes(key);
    const unit = key === 'reps' ? '次' : key === 'sets' ? '组' : '秒';
    const d = isT ? timeLabel(cfg[key]) : { t: String(cfg[key]), u: unit };
    el.innerHTML = d.t + `<small>${d.u}</small>`;
  }
  saveCfg(); renderPreset(); reset(); paintInfo();
  document.querySelectorAll('#chipPreset .chip').forEach(c => c.classList.toggle('on', c.dataset.p === 'custom'));
}

/* ── 预设法 ── */
function renderPreset(){
  $('preset').innerHTML = Object.entries(PRESETS)
    .map(([k,p]) => `<option value="${k}" ${cfg.preset===k?'selected':''}>${p.name}</option>`).join('');
}
function openDrawer(){ $('mask').classList.add('on'); $('drawer').classList.add('on'); renderDrawer(); }
function closeDrawer(){
  $('mask').classList.remove('on'); $('drawer').classList.remove('on');
  renderPreset(); paintInfo(); paintStage();
}

/* ── 启动 ── */
loadCfg();
restoreMusic();
renderPreset(); paintInfo(); buildTimeline(); remain = TL[0] ? TL[0].dur : 0; paintStage();

$('btnCfg').onclick = openDrawer;
$('btnClose').onclick = closeDrawer;
$('mask').onclick = closeDrawer;
$('btnPlay').onclick = togglePause;
$('btnReset').onclick = reset;
$('btnSkip').onclick = skip;
$('preset').onchange = e => {
  const k = e.target.value, p = PRESETS[k];
  Object.assign(cfg, { preset:k, name:p.name, work:p.work, rest:p.rest, reps:p.reps,
                       sets:p.sets, setRest:p.setRest, warm:p.warm, cool:p.cool });
  if(p.ex) cfg.exercises = p.ex.slice();
  saveCfg(); reset(); paintInfo();
};

document.addEventListener('keydown', e => {
  if(e.code === 'Space'){ e.preventDefault(); togglePause(); }
  if(e.code === 'KeyR'){ reset(); }
  if(e.code === 'ArrowRight'){ skip(); }
});
document.addEventListener('gesturestart', e => e.preventDefault());
