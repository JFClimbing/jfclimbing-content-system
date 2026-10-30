/* 指力训练计时器
 * 计划 = 若干「动作块」
 * 块 = { name, type:'time'|'reps', work, target, rounds, rest, sets, setRest, alts }
 */
'use strict';

/* ─────────── 内置计划 ─────────── */
const PLANS = {
  fbo:   { name:'开握 7:50', blocks:[
            { name:'开握悬挂', type:'time', work:7, target:'7 秒', rounds:6, rest:3, sets:3, setRest:120 }] },
  fbh:   { name:'半抠 5:55', blocks:[
            { name:'半抠悬挂', type:'time', work:5, target:'5 秒', rounds:5, rest:5, sets:3, setRest:120 }] },
  fbm:   { name:'开握 + 半抠', blocks:[
            { name:'开握悬挂', type:'time', work:7, target:'7 秒', rounds:6, rest:3, sets:3, setRest:120 },
            { name:'半抠悬挂', type:'time', work:5, target:'5 秒', rounds:5, rest:5, sets:3, setRest:120 }] },
  arm:   { name:'手臂 + 背部', blocks:[
            { name:'引体向上', type:'reps', target:'8–12 次', rounds:1, sets:3, setRest:90,
              alts:['引体向上','反向划船','跳跃引体+离心','离心引体'] },
            { name:'俯卧撑', type:'reps', target:'12–15 次', rounds:1, sets:3, setRest:90,
              alts:['标准俯卧撑','跪姿俯卧撑','窄距俯卧撑'] },
            { name:'澳式划船', type:'reps', target:'10 次', rounds:1, sets:3, setRest:90 },
            { name:'小臂静态弯举', type:'reps', target:'15 次（停 2 秒）', rounds:1, sets:3, setRest:60 },
            { name:'平板支撑', type:'time', work:45, target:'30–60 秒', rounds:1, sets:3, setRest:60,
              alts:['平板支撑','侧平板'] }] },
  max:   { name:'最大力量 10 秒', blocks:[
            { name:'最大悬吊', type:'time', work:10, target:'10 秒', rounds:1, sets:5, setRest:180 }] },
  abra:  { name:'Abrahangs 长组', blocks:[
            { name:'开握悬挂', type:'time', work:7, target:'7 秒', rounds:6, rest:3, sets:6, setRest:180 }] },
  dens:  { name:'密度 5:5', blocks:[
            { name:'开握悬挂', type:'time', work:5, target:'5 秒', rounds:10, rest:5, sets:3, setRest:120 }] },
  lite:  { name:'入门 6:4', blocks:[
            { name:'开握悬挂', type:'time', work:6, target:'6 秒', rounds:5, rest:4, sets:3, setRest:150 }] },
  fore:  { name:'前臂耐力 30:30', blocks:[
            { name:'开握悬挂', type:'time', work:30, target:'30 秒', rounds:3, rest:30, sets:3, setRest:120 }] }
};

const KEY = 'hb_v4', HKEY = 'hb_hist_v4';

let cfg = {
  planId:'b:fbo', planName:'开握 7:50',
  blocks: JSON.parse(JSON.stringify(PLANS.fbo.blocks)),
  pick:{}, saved:[],
  warm:300, cool:180, prep:5,
  voice:true, beep:true, vibrate:true, wake:true
};

function save(){ try{ localStorage.setItem(KEY, JSON.stringify(cfg)); }catch(e){} }
function load(){
  try{
    const s = JSON.parse(localStorage.getItem(KEY));
    if(s && s.blocks) Object.assign(cfg, s);
    if(!Array.isArray(cfg.saved)) cfg.saved = [];
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
  return { t:String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0'), u:'' };
};
function setText(el, v){ if(el && el.textContent !== v) el.textContent = v; }
function setHTML(el, v){ if(el && el._h !== v){ el.innerHTML = v; el._h = v; } }

/* ─────────── 声音 ─────────── */
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
function double(){ beep(880,0.07,0.30); setTimeout(() => beep(1320,0.07,0.26), 90); }
function buzz(p){ if(cfg.vibrate && navigator.vibrate){ try{ navigator.vibrate(p); }catch(e){} } }

function speak(text, rate, interrupt){
  if(!cfg.voice || !('speechSynthesis' in window)) return;
  try{
    if(interrupt && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN'; u.volume = 1; u.rate = rate || 1.2; u.pitch = 1;
    speechSynthesis.speak(u);
  }catch(e){}
}
let voiceWarm = false;
function warmVoice(){
  if(voiceWarm || !('speechSynthesis' in window)) return;
  voiceWarm = true;
  try{
    const u = new SpeechSynthesisUtterance(' ');
    u.lang = 'zh-CN'; u.volume = 0.01; u.rate = 2;
    speechSynthesis.speak(u);
    speechSynthesis.cancel();
  }catch(e){}
}

/* ─────────── 时间线 ─────────── */
let TL = [], idx = 0, remain = 0, endAt = 0, startAt = 0, openEl = 0;
let running = false, paused = false, finished = false, timer = null;

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
        TL.push({ t:'work', label:nm, open:b.type === 'reps',
          dur: b.type === 'time' ? (b.work || 0) : 0,
          set:s, sets:b.sets, round:r, rounds:rounds,
          target: b.target || (b.type === 'time' ? (b.work + ' 秒') : ''),
          c:'#ff9f0a' });
        if(r < rounds) TL.push({ t:'rest', label:'休息', dur:b.rest || 0, c:'#30d158', next:nm });
      }
      if(s < b.sets) TL.push({ t:'setrest', label:'组间休息', dur:b.setRest || 0, c:'#30d158', next:nm, nextSet:s+1, sets:b.sets });
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
  setText($('gBlocks'), blocks.length ? (blocks.slice(0,2).map((b,i) => {
    const pk = cfg.pick[cfg.blocks.indexOf(b)] || 0;
    return (b.alts && b.alts[pk]) ? b.alts[pk] : b.name;
  }).join(' · ') + (blocks.length > 2 ? ' +' + (blocks.length-2) : '')) : '—');
  setText($('gSets'), blocks.length ? blocks.reduce((a,b)=>a+b.sets,0) + ' 组' : '—');
  setText($('gTotal'), fmt(totalSec()));
  setText($('gWarm'), fmt(cfg.warm));
  setText($('gCool'), fmt(cfg.cool));
}

function paint(){
  if(!running && !finished){
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
  const seg = TL[idx]; if(!seg) return;
  document.querySelector('.stage').classList.toggle('done', seg.t === 'done');

  if(seg._l !== seg.label){ seg._l = seg.label; setText($('phase'), seg.label); }
  if(seg._c !== seg.c){
    seg._c = seg.c;
    $('cd').style.color = seg.c;
    $('ringFg').setAttribute('stroke', seg.c);
  }
  setText($('cd'), seg.open ? fmt(openEl) : fmt(seg.t === 'done' ? 0 : remain));
  const small = !seg.open && (seg.t === 'setrest' || seg.t === 'warm' || seg.t === 'cool' || seg.t === 'prep');
  const cd = $('cd');
  if(cd.classList.contains('small') !== small) cd.classList.toggle('small', small);

  const C = 2 * Math.PI * 46;
  const pct = seg.open ? Math.min(1, openEl/20) : (seg.dur ? Math.max(0, (seg.dur - remain)/seg.dur) : 0);
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
      s = `组间休息` + (seg.nextSet ? ` · 下一组 <b>${seg.nextSet}</b>/${seg.sets || ''}` : '');
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
  const seg = TL[idx];

  if(seg && seg.open){
    openEl = (Date.now() - startAt) / 1000;
    paint();
    return;
  }

  const left = (endAt - Date.now()) / 1000;

  if(seg && seg.dur > 0){
    const r = Math.ceil(left);
    // 准备段：整个阶段每秒都报数；其他段：只在最后 3 秒报
    const from = (seg.t === 'prep') ? Math.ceil(seg.dur) : (seg.dur >= 6 ? 3 : 0);
    if(from > 0 && r > 0 && r <= from && r !== seg._b){
      seg._b = r;
      buzz(18);
      if(cfg.voice) speak(String(r), seg.t === 'prep' ? 1.3 : 1.75, false);
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

  // 准点提示音
  if(seg.t === 'work'){ double(); buzz([40,60,40]); }
  else if(seg.t === 'prep'){ beep(760,0.09,0.26); buzz(30); }
  else if(seg.t === 'rest' || seg.t === 'setrest'){ beep(520,0.10,0.28); buzz(120); }
  else if(seg.t === 'cool' || seg.t === 'done'){ beep(660,0.14,0.30); }
  else { beep(700,0.08,0.22); }

  // ⭐ 每个阶段都有人声播报
  let say = '';
  if(seg.t === 'work') say = seg.label;
  else if(seg.t === 'prep') say = '准备';
  else if(seg.t === 'rest') say = '休息';
  else if(seg.t === 'setrest') say = '组间休息';
  else if(seg.t === 'warm') say = '热身开始';
  else if(seg.t === 'cool') say = '放松';
  else if(seg.t === 'done') say = '完成';
  if(say) setTimeout(() => speak(say, 1.2, true), 150);

  paint();
}

function finish(){
  running = false; paused = false; finished = true;
  clearInterval(timer);
  [0,180,360,620].forEach((d,i)=>setTimeout(()=>beep(660+i*160,0.16,0.32), d));
  buzz([100,80,100,80,200]);
  speak('训练完成', 1.1, true);
  logSession();
  paint(); paintBtn();
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
  warmVoice();
  beep(880, 0.09, 0.3);

  // ⭐ 第一段也要播报（它没有「切换」事件）
  const first = TL[idx];
  if(first){
    if(first.t === 'warm') setTimeout(() => speak('热身开始', 1.2, true), 200);
    else if(first.t === 'prep') setTimeout(() => speak('准备', 1.2, true), 200);
    else if(first.t === 'work') setTimeout(() => speak(first.label, 1.2, true), 200);
  }

  paint(); paintBtn();
  clearInterval(timer); timer = setInterval(tick, TICK);
}

function toggle(){
  if(!running){ start(); return; }
  if(!paused){
    remain = Math.max(0, (endAt - Date.now()) / 1000);
    paused = true; clearInterval(timer);
  } else {
    paused = false; enterSeg();
    clearInterval(timer); timer = setInterval(tick, TICK);
  }
  paintBtn(); paint();
}

function reset(){
  running = false; paused = false; finished = false;
  clearInterval(timer);
  build(); remain = TL[0] ? TL[0].dur : 0;
  releaseWake();
  paint(); paintBtn();
}

function skip(){
  if(!running){ start(); return; }
  if(paused){ paused = false; clearInterval(timer); timer = setInterval(tick, TICK); }
  next();
}

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
      blocks: cfg.blocks.map((b,i) => (b.alts && b.alts[cfg.pick[i]||0]) ? b.alts[cfg.pick[i]||0] : b.name) });
    localStorage.setItem(HKEY, JSON.stringify(h.slice(0, 80)));
  }catch(e){}
}
function renderLog(){
  const el = $('logPage'); if(!el) return;
  const h = readHist(), now = Date.now();
  const wk = h.filter(x => x.d > now - 7*864e5).length;
  const mo = h.filter(x => x.d > now - 30*864e5).length;
  const mins = Math.round(h.reduce((a,x)=>a+(x.total||0),0)/60);
  const last = h[0] ? Math.floor((now - h[0].d)/864e5) : null;
  el.innerHTML = `
    <div class="grp"><h3>统计</h3><div class="stat">
      本周 <b>${wk}</b> 次 ｜ 近 30 天 <b>${mo}</b> 次<br>
      累计 <b>${h.length}</b> 次 · 共 <b>${mins}</b> 分钟<br>
      ${last === null ? '还没有记录' : (last === 0 ? '今天已经练过' : `距上次训练 <b>${last}</b> 天`)}
    </div></div>
    <div class="grp"><h3>训练记录</h3>
      ${h.length ? h.map(x => {
        const d = new Date(x.d);
        const ds = `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        return `<div class="hrow"><div class="h1">${x.name}</div>
          <div class="h2">${ds} · ${fmt(x.total)}${x.blocks ? ' · ' + x.blocks.slice(0,3).join(' / ') : ''}</div></div>`;
      }).join('') : '<div class="empty">还没有训练记录</div>'}
    </div>
    ${h.length ? '<button class="btn ghost" id="clearHist">清空记录</button>' : ''}`;
  const c = $('clearHist');
  if(c) c.onclick = () => { localStorage.removeItem(HKEY); renderLog(); };
}

/* ─────────── 设置页 ─────────── */
function renderSet(){
  const el = $('setPage'); if(!el) return;
  const sw = (k, lab, sub) => `<div class="row"><div class="lab">${lab}<small>${sub}</small></div>
    <div class="sw ${cfg[k]?'on':''}" data-sw="${k}"></div></div>`;
  el.innerHTML = `
    <div class="grp"><h3>声音</h3>
      ${sw('voice','语音播报','念动作名、倒数、准备')}
      ${sw('beep','提示音','阶段切换的短音')}
      ${sw('vibrate','震动','需要手机支持')}
      ${sw('wake','屏幕常亮','训练中不自动锁屏')}
    </div>
    <div class="grp"><h3>开与收</h3>
      <div class="row"><div class="lab">热身<small>训练前准备</small></div>
        <div class="stp"><button data-inc="warm" data-d="-1">−</button><div class="v" id="sv_warm">${mmss(cfg.warm).t}<small>${mmss(cfg.warm).u}</small></div><button data-inc="warm" data-d="1">+</button></div></div>
      <div class="row"><div class="lab">放松<small>训练后拉伸</small></div>
        <div class="stp"><button data-inc="cool" data-d="-1">−</button><div class="v" id="sv_cool">${mmss(cfg.cool).t}<small>${mmss(cfg.cool).u}</small></div><button data-inc="cool" data-d="1">+</button></div></div>
      <div class="row"><div class="lab">准备倒数<small>正式开始前几秒</small></div>
        <div class="stp"><button data-inc="prep" data-d="-1">−</button><div class="v" id="sv_prep">${cfg.prep}<small>秒</small></div><button data-inc="prep" data-d="1">+</button></div></div>
    </div>
    <div class="note">训练计划和动作都在主界面改，这里只管声音和开与收。</div>`;
  el.querySelectorAll('[data-sw]').forEach(s => s.onclick = () => {
    const k = s.dataset.sw;
    cfg[k] = !cfg[k]; s.classList.toggle('on', cfg[k]);
    save();
    if(k === 'voice' && cfg.voice) speak('语音已开启', 1.1, true);
  });
  el.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => {
    const k = b.dataset.inc, d = +b.dataset.d;
    const step = k === 'prep' ? 1 : 30;
    const mx = k === 'prep' ? 15 : 900;
    cfg[k] = Math.min(mx, Math.max(0, cfg[k] + d*step));
    save();
    const e2 = $('sv_' + k);
    if(e2) e2.innerHTML = k === 'prep' ? cfg[k] + '<small>秒</small>'
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
    const curSaved = cfg.planId && cfg.planId.startsWith('s:');
    b.innerHTML = `
      <div style="padding:2px 2px 12px">
        <div style="font-size:12px;color:var(--muted);font-weight:700;margin-bottom:6px">计划名称（可直接改）</div>
        <input class="sel2" id="planName" value="${(cfg.planName||'').replace(/"/g,'&quot;')}"
               style="width:100%;font-size:15px;font-weight:800;padding:11px 12px">
      </div>
      <div style="font-size:12px;color:var(--muted);font-weight:700;margin:6px 2px 4px">内置计划</div>
      ${Object.entries(PLANS).map(([k,p2]) => `
        <div class="pickrow ${cfg.planId===('b:'+k)?'on':''}" data-b="${k}">
          <span class="pn">${p2.name}</span><span class="pd">${p2.blocks.length} 个动作</span>
        </div>`).join('')}
      <div style="font-size:12px;color:var(--muted);font-weight:700;margin:16px 2px 4px">我的计划（${cfg.saved.length}）</div>
      ${cfg.saved.length ? cfg.saved.map(sp => `
        <div class="pickrow ${cfg.planId===('s:'+sp.id)?'on':''}" data-s="${sp.id}">
          <span class="pn">${sp.name}</span><span class="pd">${sp.blocks.length} 个动作</span>
          <span class="blk-x" data-delplan="${sp.id}" style="margin-left:4px">✕</span>
        </div>`).join('') : '<div class="empty" style="padding:14px 0">还没有保存过计划</div>'}
      <button class="btn pri" id="savePlan" style="margin:16px 0 10px">保存当前计划</button>
      ${curSaved ? '<button class="btn ghost" id="updPlan" style="margin-top:0">覆盖当前计划</button>' : ''}
      <div style="height:8px"></div>`;

    $('planName').oninput = e => {
      cfg.planName = e.target.value;
      if(cfg.planId && cfg.planId.startsWith('s:')){
        const sp = cfg.saved.find(x => 's:' + x.id === cfg.planId);
        if(sp) sp.name = e.target.value;
      }
      save(); paintInfo();
    };
    b.querySelectorAll('[data-b]').forEach(r => r.onclick = () => {
      const k = r.dataset.b, p2 = PLANS[k];
      cfg.planId = 'b:' + k; cfg.planName = p2.name;
      cfg.blocks = JSON.parse(JSON.stringify(p2.blocks)); cfg.pick = {};
      changed(); closeSheet();
    });
    b.querySelectorAll('[data-s]').forEach(r => r.onclick = e => {
      if(e.target.dataset.delplan) return;
      const sp = cfg.saved.find(x => x.id === r.dataset.s); if(!sp) return;
      cfg.planId = 's:' + sp.id; cfg.planName = sp.name;
      cfg.blocks = JSON.parse(JSON.stringify(sp.blocks));
      cfg.pick = JSON.parse(JSON.stringify(sp.pick || {}));
      changed(); closeSheet();
    });
    b.querySelectorAll('[data-delplan]').forEach(x => x.onclick = e => {
      e.stopPropagation();
      const id = x.dataset.delplan;
      cfg.saved = cfg.saved.filter(v => v.id !== id);
      if(cfg.planId === 's:' + id) cfg.planId = '';
      save(); openSheet('plan');
    });
    const sv = $('savePlan');
    if(sv) sv.onclick = () => {
      const id = 'p' + Date.now().toString(36);
      cfg.saved.push({ id, name:(cfg.planName||'').trim() || '我的计划',
        blocks: JSON.parse(JSON.stringify(cfg.blocks)),
        pick: JSON.parse(JSON.stringify(cfg.pick || {})) });
      cfg.planId = 's:' + id;
      save(); openSheet('plan'); paintInfo();
    };
    const up = $('updPlan');
    if(up) up.onclick = () => {
      const sp = cfg.saved.find(x => 's:' + x.id === cfg.planId);
      if(sp){
        sp.blocks = JSON.parse(JSON.stringify(cfg.blocks));
        sp.pick = JSON.parse(JSON.stringify(cfg.pick || {}));
        sp.name = cfg.planName || sp.name;
        save(); openSheet('plan');
      }
    };
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
          ${isTime ? `<span class="lb">时长</span><div class="stp"><button data-bf="${i}|work" data-d="-1">−</button><div class="v">${bl.work||0}<small>秒</small></div><button data-bf="${i}|work" data-d="1">+</button></div>` : `<span class="lb">计次动作</span>`}
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
    b.querySelectorAll('[data-alt]').forEach(s2 => s2.onchange = () => {
      const i = +s2.dataset.alt;
      cfg.pick[i] = +s2.value;
      cfg.blocks[i].name = cfg.blocks[i].alts[+s2.value];
      changed();
    });
    b.querySelectorAll('[data-bd]').forEach(x => x.onclick = () => {
      cfg.blocks.splice(+x.dataset.bd, 1); cfg.pick = {};
      changed(); openSheet('blocks');
    });
    b.querySelectorAll('[data-bf]').forEach(x => x.onclick = () => {
      const [i, f] = x.dataset.bf.split('|');
      const bl = cfg.blocks[+i], d = +x.dataset.d;
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

  else { openSheet('blocks'); return; }

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
function switchTab(t){
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'view-' + t));
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
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

document.addEventListener('keydown', e => {
  if(e.code === 'Space'){ e.preventDefault(); toggle(); }
  if(e.code === 'KeyR') reset();
  if(e.code === 'ArrowRight') skip();
});
document.addEventListener('gesturestart', e => e.preventDefault());

paintInfo(); paint(); paintBtn();
