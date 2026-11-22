/* The Longer The Stronger — client */
(async function () {
'use strict';
const E = window.Engine;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmt = n => Number(n).toLocaleString();

// ---------------- data ----------------
const DB = await (await fetch('animals.json')).json();
const A = DB.animals;                    // sorted, id = index
const CLS = DB.classes, TIERS = DB.tiers;
const BY_ID = new Map(A.map(a => [a.id, a]));
const tierOf = p => TIERS.find(t => p >= t.min);
const MAXP = Math.max(...A.map(a => a.power)), MINP = Math.min(...A.map(a => a.power));
const img = (f, w) => f ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f)}?width=${w}` : '';
const G = E.GACHA;
const strongVs = c => Object.keys(E.TYPES[c] || {});
const weakVs = c => Object.keys(E.TYPES).filter(k => E.TYPES[k][c]);
const chip = (c, cls) => `<span class="tchip ${cls || ''}" title="${esc(CLS[c].en)}">${CLS[c].icon} ${CLS[c].ko}</span>`;
const SAMPLER = E.sampler(A, G.decay);
const S15 = E.sampler(A.filter(a => a.power >= 15), G.decay);
const SPACK = E.sampler(A.filter(a => a.power >= G.packMin), G.decay);
const BY_POWER = {};
A.forEach(a => (BY_POWER[a.power] ||= []).push(a));

// ---------------- save ----------------
const KEY = 'tlts_save_v1';
let save = JSON.parse(localStorage.getItem(KEY) || 'null');
function persist() { localStorage.setItem(KEY, JSON.stringify(save)); }
if (!save) {
  save = { coins: 1500, owned: {}, pity: 0, pulls: 0, main: null, nick: '', claimed: [], st: { aiW: 0, aiL: 0, mp: 0, mpWin: 0, earned: 0 } };
  // three starter animals
  for (let k = 0; k < 3; k++) { const a = SAMPLER.pick(Math.random()); save.owned[a.id] = (save.owned[a.id] || 0) + 1; }
  save.main = +Object.keys(save.owned).sort((x, y) => BY_ID.get(+y).power - BY_ID.get(+x).power)[0];
  persist();
}
const owns = id => (save.owned[id] || 0) > 0;
const ownedList = () => Object.keys(save.owned).map(Number).filter(owns).map(id => BY_ID.get(id)).filter(Boolean);
const mainAnimal = () => BY_ID.get(save.main) || ownedList()[0];

function addCoins(n, why) {
  save.coins += n; if (n > 0) save.st.earned += n; persist(); renderWallet();
  if (n > 0) { $('coins').parentElement.classList.remove('bump'); void $('coins').offsetWidth; $('coins').parentElement.classList.add('bump'); }
  if (why) toast(`${why} 🪙${n > 0 ? '+' : ''}${fmt(n)}`);
}
function renderWallet() { $('coins').textContent = fmt(save.coins); }
let toastT;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }

// ---------------- card UI ----------------
function cardHTML(a, opt = {}) {
  const t = tierOf(a.power), c = CLS[a.cls];
  const locked = opt.locked;
  const cnt = save.owned[a.id] || 0;
  return `<div class="card ${locked ? 'locked' : ''} ${opt.sel ? 'sel' : ''}" style="--tc:${t.color}" data-id="${a.id}" ${opt.noClick ? '' : 'data-open="1"'}>
    <div class="top"></div>
    <div class="img" ${a.image && !locked ? `style="background-image:url('${img(a.image, 320)}')"` : ''}>${a.image && !locked ? '' : c.icon}</div>
    ${opt.isNew ? '<span class="newtag">NEW</span>' : (save.main === a.id && !opt.hideMain ? '<span class="maintag">출전</span>' : '')}
    ${cnt > 1 && !opt.hideCount ? `<span class="cnt">x${cnt}</span>` : ''}
    <div class="body">
      <span class="tier">${t.name}</span>
      <div class="name">${locked ? '?'.repeat(Math.min(a.name.length, 24)) : esc(a.name)}</div>
      ${a.ko && !locked ? `<div class="ko">${esc(a.ko)}</div>` : ''}
      ${locked ? '' : `<div class="sci">${esc(a.sci)}</div>`}
      <div class="bar"><i style="width:${a.power / MAXP * 100}%"></i></div>
      <div class="foot"><span class="pow">${a.power}<small>글자</small></span><span class="badge">${c.icon} ${c.ko}</span></div>
    </div></div>`;
}

function openCard(id) {
  const a = BY_ID.get(id); if (!a) return;
  const t = tierOf(a.power), c = CLS[a.cls], st = E.stats(a.power);
  const rank = 1 + A.filter(b => b.power > a.power).length;
  const letters = [...a.name].map(ch => /[A-Za-zÀ-ÿ]/.test(ch) ? `<b>${ch.toUpperCase()}</b>` : `<b class="sp">${ch === ' ' ? '' : esc(ch)}</b>`).join('');
  $('sheet').style.setProperty('--tc', t.color);
  $('sheet').innerHTML = `
    <button class="close" data-close>×</button>
    ${a.image ? `<div class="img" style="background-image:url('${img(a.image, 900)}')"></div>` : ''}
    <div class="in">
      <span class="tier" style="color:${t.color}">${t.name} · ${t.ko}</span>
      <h2>${esc(a.name)}</h2>
      ${a.ko ? `<div class="muted">${esc(a.ko)}</div>` : ''}
      <div class="letters">${letters}</div>
      <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:14px">
        <span class="pow" style="font-size:44px;color:${t.color}">${a.power}</span><span class="muted">글자 · 전체 ${fmt(rank)}위 / ${fmt(A.length)}</span>
      </div>
      <dl>
        <dt>배틀 능력치</dt><dd>HP ${st.hp} · 공격 ${Math.round(st.atk)} · 속도 ${Math.round(st.spd)}</dd>
        <dt>학명</dt><dd><i>${esc(a.sci)}</i></dd>
        <dt>속</dt><dd><i>${esc(a.genus)}</i> — 이 속에서 가장 긴 이름 (이름 있는 종 ${a.genusNamed}개 중)</dd>
        ${a.family ? `<dt>과</dt><dd>${esc(a.family)}</dd>` : ''}
        ${a.order ? `<dt>목</dt><dd>${esc(a.order)}</dd>` : ''}
        <dt>분류</dt><dd>${c.icon} ${c.ko} (${c.en})</dd>
        <dt>강함 ▲</dt><dd>${strongVs(a.cls).map(k => chip(k, 'up')).join(' ') || '-'}</dd>
        <dt>약함 ▼</dt><dd>${weakVs(a.cls).map(k => chip(k, 'down')).join(' ') || '-'}</dd>
        ${a.extinct ? '<dt>상태</dt><dd>멸종</dd>' : ''}
        <dt>보유</dt><dd>${save.owned[a.id] || 0}장</dd>
        <dt>출처</dt><dd><a href="https://www.wikidata.org/wiki/${a.qid}" target="_blank" rel="noopener">Wikidata ${a.qid}</a></dd>
      </dl>
      ${owns(a.id) ? (save.main === a.id ? '<button class="btn ghost" disabled>현재 출전 동물</button>' : `<button class="btn" data-setmain="${a.id}">출전 동물로 설정</button>`) : ''}
    </div>`;
  $('modal').classList.add('on');
}
document.addEventListener('click', e => {
  const sm = e.target.closest('[data-setmain]');
  if (sm) { setMain(+sm.dataset.setmain); $('modal').classList.remove('on'); return; }
  if (e.target.closest('[data-close]') || e.target.id === 'modal') { $('modal').classList.remove('on'); return; }
  const go = e.target.closest('[data-go]');
  if (go) { show(go.dataset.go); return; }
  const op = e.target.closest('[data-open]');
  if (op && !op.closest('#picker') && !op.classList.contains('locked')) openCard(+op.dataset.id);
});
function setMain(id) {
  save.main = id; persist(); toast(`출전 동물: ${BY_ID.get(id).name}`);
  if (room) socket.emit('room:pick', { animalId: id });
  refresh();
}

// ---------------- picker ----------------
let pickResolve = null;
function pickAnimal() {
  $('pq').value = ''; renderPicker(); $('picker').classList.add('on');
  return new Promise(r => { pickResolve = r; });
}
function renderPicker() {
  const q = $('pq').value.trim().toLowerCase();
  const xs = ownedList().filter(a => !q || a.name.toLowerCase().includes(q) || (a.ko || '').includes(q)).sort((x, y) => y.power - x.power);
  $('pgrid').innerHTML = xs.slice(0, 300).map(a => cardHTML(a, { noClick: true, sel: a.id === save.main })).join('');
}
$('pq').addEventListener('input', renderPicker);
$('pgrid').addEventListener('click', e => {
  const c = e.target.closest('.card'); if (!c) return;
  $('picker').classList.remove('on'); pickResolve && pickResolve(+c.dataset.id); pickResolve = null;
});
$('pclose').onclick = () => { $('picker').classList.remove('on'); pickResolve && pickResolve(null); pickResolve = null; };

// ---------------- navigation ----------------
let current = 'home';
function show(name) {
  current = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === name));
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.go === name));
  refresh();
  window.scrollTo(0, 0);
}
function refresh() {
  renderWallet();
  if (current === 'home') renderHome();
  if (current === 'gacha') renderGacha();
  if (current === 'dex') applyFilters();
  if (current === 'ai') renderAI();
  if (current === 'multi') renderMulti();
  if (current === 'types') renderTypes();
}

// ---------------- home ----------------
function renderHome() {
  const m = mainAnimal();
  $('homeMain').innerHTML = m ? cardHTML(m) : '<p class="muted">동물이 없어요. 뽑기를 해보세요!</p>';
  const own = ownedList();
  const s = save.st;
  $('homeStats').innerHTML = `
    <span>보유 동물 (속)</span><b>${fmt(own.length)} / ${fmt(A.length)}</b>
    <span>최장 보유</span><b>${own.length ? Math.max(...own.map(a => a.power)) : 0}글자</b>
    <span>총 뽑기</span><b>${fmt(save.pulls)}</b>
    <span>AI 배틀 승/패</span><b>${s.aiW} / ${s.aiL}</b>
    <span>멀티 배틀 (1위)</span><b>${s.mp} (${s.mpWin})</b>
    <span>누적 획득</span><b>🪙${fmt(s.earned)}</b>`;
}

// ---------------- dex ----------------
for (const [k, v] of Object.entries(CLS)) $('cls').insertAdjacentHTML('beforeend', `<option value="${k}">${v.icon} ${v.ko}</option>`);
for (const t of TIERS) $('tierSel').insertAdjacentHTML('beforeend', `<option value="${t.id}">${t.name} · ${t.ko} (${t.min}+)</option>`);
let dexMode = 'own', list = [], shown = 0;
$('dexMode').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  dexMode = b.dataset.m; [...$('dexMode').children].forEach(x => x.classList.toggle('on', x === b)); applyFilters();
};
function applyFilters() {
  const q = $('q').value.trim().toLowerCase(), c = $('cls').value, tr = $('tierSel').value, s = $('sort').value;
  list = A.filter(a => {
    if (dexMode === 'own' && !owns(a.id)) return false;
    if (c && a.cls !== c) return false;
    if (tr && tierOf(a.power).id !== tr) return false;
    if (q) {
      if (dexMode === 'all' && !owns(a.id)) return false; // can't search names you haven't discovered
      if (!(a.name.toLowerCase().includes(q) || a.sci.toLowerCase().includes(q) || (a.ko || '').includes(q))) return false;
    }
    return true;
  });
  const by = { pd: (x, y) => y.power - x.power || x.name.localeCompare(y.name), pa: (x, y) => x.power - y.power || x.name.localeCompare(y.name), na: (x, y) => x.name.localeCompare(y.name) }[s];
  list.sort(by);
  const ownN = ownedList().length;
  $('count').textContent = dexMode === 'own' ? `${fmt(list.length)}종 보유` : `${fmt(list.length)}종 · 발견 ${fmt(ownN)} / ${fmt(A.length)}`;
  $('grid').innerHTML = ''; shown = 0; renderMore();
}
function renderMore() {
  const chunk = list.slice(shown, shown + 96);
  $('grid').insertAdjacentHTML('beforeend', chunk.map(a => cardHTML(a, { locked: !owns(a.id) })).join(''));
  shown += chunk.length;
  $('more').textContent = shown < list.length ? '스크롤하면 더 불러옵니다…' : (list.length ? '' : (dexMode === 'own' ? '아직 보유한 동물이 없어요.' : '결과 없음'));
}
new IntersectionObserver(e => { if (e[0].isIntersecting && shown < list.length && current === 'dex') renderMore(); }, { rootMargin: '600px' }).observe($('more'));
let deb; $('q').addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(applyFilters, 150); });
['cls', 'tierSel', 'sort'].forEach(id => $(id).addEventListener('change', applyFilters));

// ---------------- gacha ----------------
$('cost1').textContent = fmt(G.cost1); $('cost10').textContent = fmt(G.cost10);
$('dupRefund').textContent = G.dupRefund;
$('packDesc').textContent = `${G.packMin}글자 이상 ${G.packSize}마리`;
(function oddsTable() {
  const th = [25, 20, 10, 0];
  const p = E.odds(A, G.decay, th);
  const rows = [
    ['gold', '25글자 이상 (황금빛)', p[0]],
    ['purple', '20–24글자 (보랏빛)', p[1] - p[0]],
    ['blue', '10–19글자 (푸른빛)', p[2] - p[1]],
    ['white', '9글자 이하', p[3] - p[2]],
  ];
  $('oddsTable').innerHTML = rows.map(([g, l, v]) => `<tr><td><span class="dot" style="background:var(--g-${g})"></span>${l}</td><td>${v < 1 ? v.toFixed(2) : v.toFixed(1)}%</td></tr>`).join('')
    + `<tr><td>천장 (${G.pity}회마다)</td><td>${G.packMin}글자+ ×${G.packSize}</td></tr>`;
})();
function renderGacha() {
  $('pityLeft').textContent = G.pity - save.pity;
  $('pityBar').style.width = (save.pity / G.pity * 100) + '%';
  $('pull1').disabled = save.coins < G.cost1;
  $('pull10').disabled = save.coins < G.cost10;
}
function roll(n) {
  const res = [];
  for (let k = 0; k < n; k++) res.push({ a: SAMPLER.pick(Math.random()) });
  if (n === 10 && !res.some(r => r.a.power >= 15)) res[9] = { a: S15.pick(Math.random()) };
  return res;
}
async function doPull(n) {
  const cost = n === 10 ? G.cost10 : G.cost1;
  if (save.coins < cost || revealing) return;
  addCoins(-cost);
  const results = roll(n);
  // pity
  const queue = [];
  for (const r of results) {
    queue.push(r);
    save.pity++; save.pulls++;
    if (save.pity >= G.pity) {
      save.pity = 0;
      for (let k = 0; k < G.packSize; k++) queue.push({ a: SPACK.pick(Math.random()), pack: true, packIdx: k });
    }
  }
  // apply to collection
  let refund = 0;
  for (const r of queue) {
    r.isNew = !owns(r.a.id);
    save.owned[r.a.id] = (save.owned[r.a.id] || 0) + 1;
    if (!r.isNew) refund += G.dupRefund;
  }
  persist();
  await revealSequence(queue);
  if (refund) addCoins(refund, '중복 환급');
  $('lastTitle').classList.remove('hidden');
  $('lastPull').innerHTML = queue.map(r => cardHTML(r.a, { isNew: r.isNew, hideMain: true })).join('');
  renderGacha();
}
$('pull1').onclick = () => doPull(1);
$('pull10').onclick = () => doPull(10);

// ---------------- reveal animation ----------------
let revealing = false, skipOne = null, skipAll = false;
function wait(ms) {
  return new Promise(res => {
    if (skipAll) return res();
    const t = setTimeout(done, ms);
    function done() { clearTimeout(t); skipOne = null; res(); }
    skipOne = done;
  });
}
$('reveal').addEventListener('click', e => { if (e.target.id === 'rSkipAll') return; skipOne && skipOne(); });
$('rSkipAll').onclick = e => { e.stopPropagation(); skipAll = true; skipOne && skipOne(); };

async function revealSequence(queue) {
  revealing = true; skipAll = false;
  $('reveal').classList.add('on');
  for (let k = 0; k < queue.length; k++) {
    $('rCount').textContent = `${k + 1} / ${queue.length}`;
    await revealOne(queue[k]);
    if (skipAll) break;
  }
  $('reveal').classList.remove('on');
  revealing = false;
}
async function revealOne(r) {
  const a = r.a, c = CLS[a.cls], t = tierOf(a.power), glow = E.glowOf(a.power);
  const st = $('stage');
  st.className = 'stage ' + glow;
  $('rPack').classList.toggle('hidden', !r.pack);
  if (r.pack) $('rPack').textContent = `🎁 동물 팩! (${r.packIdx + 1}/${G.packSize})`;
  $('rClass').className = 'r-class'; $('rClass').innerHTML = `<span class="ic">${c.icon}</span><span class="t">${c.ko}</span><span class="e">${c.en.toUpperCase()}</span>`;
  $('rPower').className = 'r-power'; $('rPower').innerHTML = '';
  $('rName').innerHTML = '';
  $('rCard').className = 'r-card'; $('rCard').innerHTML = '';
  void st.offsetWidth;
  // 1. door rattles, light leaks
  st.classList.add('shake');
  await wait(glow === 'gold' ? 1300 : glow === 'purple' ? 1000 : 700);
  // 2. door opens with colored light
  st.classList.remove('shake'); st.classList.add('open');
  await wait(1000);
  // 3. class
  $('rClass').classList.add('on');
  await wait(900);
  // 4. letter count
  $('rPower').classList.add('on');
  const dur = 700 + a.power * 25, t0 = performance.now();
  await new Promise(res => {
    if (skipAll) return res();
    let stop = false;
    skipOne = () => { stop = true; };
    (function tick(now) {
      const p = stop ? 1 : Math.min(1, (now - t0) / dur);
      $('rPower').innerHTML = `${Math.round(a.power * p)}<small>글자</small>`;
      if (p < 1) requestAnimationFrame(tick); else { skipOne = null; res(); }
    })(t0);
  });
  $('rPower').innerHTML = `${a.power}<small>글자</small>`;
  await wait(500);
  // 5. name + light burst
  st.classList.add('burst');
  $('rName').innerHTML = [...a.name].map((ch, i) => `<span style="animation-delay:${i * 28}ms">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');
  $('rCard').innerHTML = `
    <div class="rimg" ${a.image ? `style="background-image:url('${img(a.image, 320)}')"` : ''}>${a.image ? '' : c.icon}</div>
    ${a.ko ? `<div>${esc(a.ko)}</div>` : ''}<div><i>${esc(a.sci)}</i></div>
    <div class="rtier">${t.name} · ${t.ko}</div>
    ${r.isNew ? '<span class="rnew">NEW!</span>' : `<span class="rdup">중복 +🪙${G.dupRefund}</span>`}`;
  await sleep(skipAll ? 0 : 300);
  $('rCard').classList.add('on');
  // wait for click
  if (!skipAll) await new Promise(res => { skipOne = () => { skipOne = null; res(); }; });
}

// ---------------- battle playback ----------------
let speed = 1, skipBattle = false;
document.querySelector('.b-speed').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.s === 'skip') { skipBattle = true; return; }
  speed = +b.dataset.s;
  document.querySelectorAll('.b-speed button').forEach(x => x.classList.toggle('on', x === b));
});
const STEP = 650;
function fighterHTML(f, meId, all) {
  const a = f.animal, t = tierOf(a.power), c = CLS[a.cls];
  const mu = (all || []).filter(o => o.i !== f.i).map(o => {
    const m = E.typeMult(a.cls, o.animal.cls);
    return m > 1 ? `<span class="tchip up">▲ ${CLS[o.animal.cls].icon}</span>` : m < 1 ? `<span class="tchip down">▼ ${CLS[o.animal.cls].icon}</span>` : '';
  }).join('');
  return `<div class="fighter" id="f${f.i}" style="--tc:${t.color}">
    <div class="fimg" ${a.image ? `style="background-image:url('${img(a.image, 400)}')"` : ''}>${a.image ? '' : c.icon}</div>
    <div class="fb">
      <div class="own ${f.owner.id === meId ? 'me' : ''}">${esc(f.owner.name)}${f.owner.id === meId ? ' (나)' : ''}</div>
      <div class="fname">${esc(a.name)} <span class="tier" style="color:${t.color}">${a.power}글자</span></div>
      <div class="fcls">${c.icon} ${c.ko} ${mu}</div>
      <div class="hpbar"><i style="width:100%"></i></div>
      <div class="hpt"><span class="hp">${f.maxHp}</span><span>/ ${f.maxHp} · 공격 ${f.atk}</span></div>
    </div>
    <div class="kot">K.O.</div>
  </div>`;
}
function setHp(f, hp) {
  const el = $('f' + f.i); const p = hp / f.maxHp * 100;
  const bar = el.querySelector('.hpbar i'); bar.style.width = p + '%';
  bar.className = p < 25 ? 'low' : p < 55 ? 'mid' : '';
  el.querySelector('.hp').textContent = hp;
}
function floatText(i, text, cls) {
  const el = $('f' + i); const d = document.createElement('div');
  d.className = 'dmg ' + (cls || ''); d.textContent = text; el.appendChild(d); setTimeout(() => d.remove(), 1000);
}
function logLine(html) { const l = $('bLog'); l.insertAdjacentHTML('beforeend', `<div>${html}</div>`); l.scrollTop = l.scrollHeight; }

// result: {fighters, log, placements}; opts: {title, meId, resultHTML: (placeOfMe) => html}
async function playBattle(result, opts) {
  skipBattle = false;
  const F = result.fighters;
  $('bTitle').textContent = opts.title; $('bRound').textContent = '';
  $('arena').className = 'arena n' + F.length;
  $('arena').innerHTML = F.map(f => fighterHTML(f, opts.meId, F)).join('');
  $('bLog').innerHTML = ''; $('bResult').classList.add('hidden');
  $('battle').classList.add('on');
  const vs = document.createElement('div'); vs.className = 'vs-intro'; vs.textContent = 'VS'; document.body.appendChild(vs);
  await sleep(1100); vs.remove();
  const nm = i => `<b style="color:${tierOf(F[i].animal.power).color}">${esc(F[i].animal.name)}</b>`;
  for (const ev of result.log) {
    if (skipBattle) break;
    if (ev.t === 'round') { $('bRound').textContent = `ROUND ${ev.n}`; continue; }
    if (ev.t === 'atk') {
      const ae = $('f' + ev.a); ae.classList.add('act');
      await sleep(STEP * 0.35 / speed);
      const de = $('f' + ev.d);
      if (ev.miss) { floatText(ev.d, 'MISS', 'miss'); logLine(`${nm(ev.a)}의 공격 → ${nm(ev.d)} 회피!`); }
      else {
        de.classList.remove('hit'); void de.offsetWidth; de.classList.add('hit');
        floatText(ev.d, (ev.crit ? 'CRIT ' : '') + '-' + ev.dmg, ev.crit ? 'crit' : '');
        if (ev.eff) floatText(ev.d, ev.eff === 'up' ? '효과가 굉장했다!' : '효과가 별로…', 'eff ' + ev.eff);
        setHp(F[ev.d], ev.hp);
        const why = ev.eff === 'up' ? E.TYPES[F[ev.a].animal.cls][F[ev.d].animal.cls] : ev.eff === 'down' ? E.TYPES[F[ev.d].animal.cls][F[ev.a].animal.cls] : '';
        logLine(`${nm(ev.a)} → ${nm(ev.d)} <b>${ev.dmg}</b> 피해${ev.crit ? ' (치명타!)' : ''}${ev.eff === 'up' ? ` <span class="up">▲상성 유리 — ${esc(why)}</span>` : ev.eff === 'down' ? ` <span class="down">▼상성 불리 — ${esc(why)}</span>` : ''}`);
      }
      await sleep(STEP * 0.65 / speed);
      ae.classList.remove('act');
    }
    if (ev.t === 'ko') { $('f' + ev.i).classList.add('ko'); logLine(`💀 ${nm(ev.i)} 쓰러짐!`); await sleep(STEP * 0.6 / speed); }
  }
  // final state (also used for skip)
  const finalHp = {}; F.forEach(f => finalHp[f.i] = f.maxHp);
  for (const ev of result.log) if (ev.t === 'atk') finalHp[ev.d] = ev.hp;
  F.forEach(f => { setHp(f, finalHp[f.i]); $('f' + f.i).classList.remove('act'); });
  result.placements.slice(1).forEach(i => $('f' + i).classList.add('ko'));
  await sleep(500);
  $('bResult').innerHTML = `<div class="panel">${opts.resultHTML()}</div>`;
  $('bResult').classList.remove('hidden');
  return new Promise(res => {
    $('bResult').querySelectorAll('[data-bact]').forEach(b => b.onclick = () => {
      $('battle').classList.remove('on'); $('bResult').classList.add('hidden'); res(b.dataset.bact);
    });
  });
}
function placesHTML(result, prizes, meId) {
  return `<div class="places">${result.placements.map((fi, k) => {
    const f = result.fighters[fi]; const pz = prizes ? prizes[k] : null;
    return `<div class="place ${f.owner.id === meId ? 'me' : ''}"><span class="pn">${['🥇', '🥈', '🥉', '4'][k] || k + 1}</span>
      <span class="pi">${esc(f.owner.name)}<small>${esc(f.animal.name)} · ${f.animal.power}글자</small></span>
      ${pz != null ? `<span class="pc">🪙${fmt(pz)}</span>` : ''}</div>`;
  }).join('')}</div>`;
}

// ---------------- type chart ----------------
$('typeRule').textContent = `상성이 유리하면 주는 피해 ×${E.TYPE_UP}, 불리하면 ×${E.TYPE_DOWN}. 대략 글자 3개 차이만큼의 효과예요 — 이름 길이가 여전히 가장 중요합니다.`;
let typeView = 'list';
$('typeView').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  typeView = b.dataset.v; [...$('typeView').children].forEach(x => x.classList.toggle('on', x === b)); renderTypes();
};
function renderTypes() {
  const keys = Object.keys(CLS);
  $('typeList').classList.toggle('hidden', typeView !== 'list');
  $('typeGrid').classList.toggle('hidden', typeView !== 'grid');
  const mine = new Set(ownedList().map(a => a.cls));
  if (typeView === 'list') {
    $('typeList').innerHTML = keys.map(k => `<div class="type-row">
      <div class="type-me">${CLS[k].icon} <b>${CLS[k].ko}</b><small>${A.filter(a => a.cls === k).length.toLocaleString()}속${mine.has(k) ? ' · 보유' : ''}</small></div>
      <div class="type-col"><div class="lbl up">▲ 강함</div>${strongVs(k).map(d => `<div class="tr">${chip(d, 'up')}<span class="muted small">${esc(E.TYPES[k][d])}</span></div>`).join('')}</div>
      <div class="type-col"><div class="lbl down">▼ 약함</div>${weakVs(k).map(d => `<div class="tr">${chip(d, 'down')}<span class="muted small">${esc(E.TYPES[d][k])}</span></div>`).join('')}</div>
    </div>`).join('');
  } else {
    let h = '<table class="type-grid"><tr><th class="corner">공격 ↓ / 방어 →</th>' + keys.map(k => `<th title="${CLS[k].ko}">${CLS[k].icon}</th>`).join('') + '</tr>';
    for (const a of keys) {
      h += `<tr><th class="rowh">${CLS[a].icon} ${CLS[a].ko}</th>` + keys.map(d => {
        const m = E.typeMult(a, d);
        return m > 1 ? `<td class="up" title="${esc(E.TYPES[a][d])}">▲</td>` : m < 1 ? `<td class="down" title="${esc(E.TYPES[d][a])}">▼</td>` : '<td></td>';
      }).join('') + '</tr>';
    }
    $('typeGrid').innerHTML = h + '</table>';
  }
}

// ---------------- AI battle ----------------
$('aiLose').textContent = E.AI_LOSE_REWARD;
$('aiChange').onclick = async () => { const id = await pickAnimal(); if (id != null) setMain(id); };
function renderAI() {
  const m = mainAnimal();
  $('aiMine').innerHTML = m ? cardHTML(m) : '<p class="muted">동물이 없어요.</p>';
  $('aiLevels').innerHTML = E.AI_LEVELS.map(l => {
    const lo = m ? Math.max(MINP, m.power + l.diff[0]) : 0, hi = m ? Math.min(MAXP, m.power + l.diff[1]) : 0;
    return `<button class="level" data-lv="${l.id}"><b>${l.ko}</b><span class="muted small">상대 ${lo}–${hi}글자</span><br><span class="rw">승리 🪙${l.reward}</span></button>`;
  }).join('');
}
$('aiLevels').addEventListener('click', async e => {
  const b = e.target.closest('[data-lv]'); if (!b) return;
  const lv = E.AI_LEVELS.find(l => l.id === b.dataset.lv); const m = mainAnimal(); if (!m) return;
  let p = m.power + lv.diff[0] + Math.floor(Math.random() * (lv.diff[1] - lv.diff[0] + 1));
  p = Math.max(MINP, Math.min(MAXP, p));
  while (!BY_POWER[p]) p += p > m.power ? -1 : 1;
  const pool = BY_POWER[p].filter(a => a.id !== m.id);
  const foe = (pool.length ? pool : BY_POWER[p])[Math.floor(Math.random() * (pool.length || BY_POWER[p].length))];
  const res = E.simulate([{ owner: { id: 'me', name: save.nick || '나' }, animal: m }, { owner: { id: 'ai', name: 'AI ' + lv.ko }, animal: foe }]);
  const win = res.fighters[res.placements[0]].owner.id === 'me';
  const reward = win ? lv.reward : E.AI_LOSE_REWARD;
  const act = await playBattle(res, {
    title: `AI 배틀 · ${lv.ko}`, meId: 'me',
    resultHTML: () => `<h2>${win ? '🏆 승리!' : '패배…'}</h2>${placesHTML(res, null, 'me')}
      <p>보상 <b style="color:var(--accent)">🪙${reward}</b></p>
      <button class="btn big" data-bact="again">다시 도전</button> <button class="btn big ghost" data-bact="close">닫기</button>`,
  });
  win ? save.st.aiW++ : save.st.aiL++;
  addCoins(reward, win ? '승리 보상' : '참가 보상');
  renderAI();
  if (act === 'again') b.click();
});

// ---------------- multiplayer ----------------
const socket = window.io ? window.io() : null;
let room = null, meId = null;
$('nick').value = save.nick || '';
$('nick').addEventListener('change', () => { save.nick = $('nick').value.trim().slice(0, 12); persist(); });
function nick() { save.nick = $('nick').value.trim().slice(0, 12) || save.nick || ('Player' + Math.floor(Math.random() * 900 + 100)); $('nick').value = save.nick; persist(); return save.nick; }

function renderMulti() {
  $('mpOffline').classList.toggle('hidden', !!socket);
  $('mpEntry').classList.toggle('hidden', !socket || !!room);
  $('mpRoom').classList.toggle('hidden', !room);
  if (!room) return;
  $('roomCode').textContent = room.code;
  const me = room.players.find(p => p.id === meId);
  const isHost = room.host === meId;
  $('roomState').textContent = room.state === 'battle' ? '⚔️ 배틀 진행 중…' : `대기 중 · ${room.players.length}/${room.max}명`;
  let html = '';
  for (let k = 0; k < room.max; k++) {
    const p = room.players[k];
    if (!p) { html += `<div class="slot"><div class="empty">빈 자리</div></div>`; continue; }
    html += `<div class="slot filled ${p.id === meId ? 'me' : ''}">
      <div class="who">${esc(p.name)}${p.id === meId ? ' (나)' : ''}${p.id === room.host ? '<span class="host">방장</span>' : ''}</div>
      ${p.animal ? cardHTML(p.animal, { noClick: true, hideCount: true, hideMain: true }) : '<div class="empty">출전 동물 미정</div>'}
    </div>`;
  }
  $('slots').innerHTML = html;
  const n = room.players.length, allReady = room.players.every(p => p.animal);
  $('startBattle').classList.toggle('hidden', !isHost);
  $('startBattle').disabled = room.state !== 'lobby' || n < 2 || !allReady;
  $('startBattle').textContent = n < 2 ? '2명 이상 필요' : !allReady ? '출전 동물 대기 중' : '배틀 시작';
  $('mpPick').disabled = room.state !== 'lobby';
  const pz = E.ROOM_PRIZES[Math.max(2, n)];
  $('prizeInfo').innerHTML = `${n}인 상금: ` + pz.map((v, k) => `${k + 1}위 🪙${v}`).join(' · ') + (isHost ? '' : ' — 방장이 시작합니다');
}
if (socket) {
  socket.on('room:update', r => { room = r; if (current === 'multi') renderMulti(); });
  socket.on('disconnect', () => { if (room) { room = null; toast('서버 연결이 끊겼어요'); renderMulti(); } });
  socket.on('battle:start', async b => {
    const my = b.prizes[meId];
    if (my && !save.claimed.includes(b.battleId)) {
      save.claimed.push(b.battleId); save.claimed = save.claimed.slice(-50);
      save.st.mp++; if (my.place === 1) save.st.mpWin++;
      addCoins(my.coins);
    }
    if (current !== 'multi') show('multi');
    const table = E.ROOM_PRIZES[b.fighters.length];
    await playBattle(b, {
      title: `멀티 배틀 · 방 ${room ? room.code : ''}`, meId,
      resultHTML: () => `<h2>${my ? (my.place === 1 ? '🏆 1위!' : `${my.place}위`) : '결과'}</h2>${placesHTML(b, table, meId)}
        ${my ? `<p>상금 <b style="color:var(--accent)">🪙${my.coins}</b> 획득</p>` : ''}
        <button class="btn big" data-bact="room">방으로 돌아가기</button>`,
    });
    renderMulti();
  });
  const afterJoin = res => {
    if (!res.ok) { $('mpErr').textContent = res.error; return; }
    $('mpErr').textContent = ''; meId = res.me;
    const m = mainAnimal(); if (m) socket.emit('room:pick', { animalId: m.id });
  };
  $('createRoom').onclick = () => socket.emit('room:create', { name: nick() }, afterJoin);
  $('joinRoom').onclick = () => {
    const code = $('joinCode').value.trim().toUpperCase();
    if (!code) { $('mpErr').textContent = '방 코드를 입력하세요.'; return; }
    socket.emit('room:join', { code, name: nick() }, afterJoin);
  };
  $('joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('joinRoom').click(); });
  $('leaveRoom').onclick = () => { socket.emit('room:leave'); room = null; renderMulti(); };
  $('copyCode').onclick = () => { navigator.clipboard?.writeText(room.code); toast('방 코드 복사됨: ' + room.code); };
  $('mpPick').onclick = async () => { const id = await pickAnimal(); if (id != null) setMain(id); };
  $('startBattle').onclick = () => socket.emit('room:start', null, res => { $('roomErr').textContent = res.ok ? '' : res.error; });
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('modal').classList.remove('on'); } });
show('home');
})();
