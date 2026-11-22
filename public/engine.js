// The Longer The Stronger — shared rules (battle + gacha). Used by browser and server.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Engine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- RNG ----------
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const newSeed = () => (Math.random() * 4294967296) >>> 0;

  // ---------- Stats: longer = stronger ----------
  function stats(power) {
    return {
      hp: Math.round(80 + power * 6),
      atk: 6 + power * 1.0,
      spd: 10 + Math.max(0, 40 - power) * 0.5, // short names act a bit faster
      crit: 0.10,
      dodge: 0.08,
    };
  }

  // ---------- Type matchups (by animal group) ----------
  // attacker group → { defender group: reason }
  const TYPES = {
    Mammalia:       { Aves: '고양이가 새를 사냥', Fish: '곰이 연어를 낚아챔', Echinodermata: '해달이 성게를 깨 먹음' },
    Aves:           { Insecta: '새가 벌레를 쪼아 먹음', Arachnida: '새가 거미를 낚아챔', Reptilia: '뱀잡이수리가 뱀을 사냥' },
    Reptilia:       { Mammalia: '뱀이 쥐를 통째로 삼킴', Amphibia: '뱀이 개구리를 삼킴', Myriapoda: '도마뱀이 지네를 사냥' },
    Amphibia:       { Insecta: '개구리 혀로 곤충 포획', Worms: '두꺼비가 지렁이를 삼킴', OtherArthro: '도롱뇽이 톡토기를 사냥' },
    Fish:           { Crustacea: '물고기가 새우를 삼킴', Worms: '물고기가 갯지렁이를 먹음', Amphibia: '물고기가 올챙이를 먹음' },
    Chondrichthyes: { Fish: '상어가 물고기 떼를 습격', Mollusca: '상어가 오징어를 사냥', Reptilia: '뱀상어가 바다거북을 깨뭄' },
    Insecta:        { Mammalia: '모기·벌의 공격', Mollusca: '반딧불이 유충이 달팽이를 사냥', Myriapoda: '개미 군단이 노래기를 제압' },
    Arachnida:      { Insecta: '거미줄에 곤충이 걸림', OtherArthro: '거미가 톡토기를 사냥' },
    Crustacea:      { Echinodermata: '게가 불가사리를 뜯어 먹음', OtherInv: '게가 멍게·해면을 먹음' },
    Myriapoda:      { Arachnida: '지네가 거미를 사냥', Worms: '지네가 지렁이를 사냥', OtherArthro: '지네가 작은 절지동물을 사냥' },
    OtherArthro:    { Cnidaria: '투구게가 해파리 폴립을 먹음', OtherInv: '곰벌레의 압도적 생존력' },
    Mollusca:       { Crustacea: '문어가 게를 사냥', Fish: '오징어가 물고기를 낚아챔' },
    Cnidaria:       { Crustacea: '해파리 촉수에 갑각류가 걸림', Chondrichthyes: '해파리 독침이 상어를 쏨' },
    Echinodermata:  { Mollusca: '불가사리가 조개를 벌려 먹음', Cnidaria: '가시관불가사리가 산호를 먹어 치움' },
    Worms:          { Mammalia: '기생충 감염', Aves: '기생충 감염', Chondrichthyes: '기생충 감염' },
    OtherInv:       { Echinodermata: '해면의 독이 불가사리를 막음', Cnidaria: '빗해파리가 해파리 유생을 먹음', Amphibia: '멍게의 독성' },
  };
  const TYPE_UP = 1.12, TYPE_DOWN = 0.9; // advantage ≈ +3 letters
  // multiplier when `att` group hits `def` group
  function typeMult(att, def) {
    if (TYPES[att] && TYPES[att][def]) return TYPE_UP;
    if (TYPES[def] && TYPES[def][att]) return TYPE_DOWN;
    return 1;
  }

  // ---------- Battle (free-for-all, 2–4 fighters) ----------
  // fighters: [{ owner, animal: {name, power, ...} }]
  // returns { seed, fighters: [...with stats], log: [...events], placements: [fighterIndex by place] }
  function simulate(fighters, seed) {
    seed = seed == null ? newSeed() : seed;
    const R = rng(seed);
    const F = fighters.map((f, i) => {
      const s = stats(f.animal.power);
      return { i, owner: f.owner, animal: f.animal, maxHp: s.hp, hp: s.hp, atk: s.atk, spd: s.spd, crit: s.crit, dodge: s.dodge, alive: true };
    });
    const log = [];
    const koOrder = [];
    const alive = () => F.filter(f => f.alive);
    let round = 0;
    while (alive().length > 1 && round < 60) {
      round++;
      log.push({ t: 'round', n: round });
      const order = alive().map(f => ({ f, k: f.spd + R() * 8 })).sort((x, y) => y.k - x.k).map(x => x.f);
      for (const a of order) {
        if (!a.alive) continue;
        const foes = F.filter(f => f.alive && f !== a);
        if (!foes.length) break;
        const d = foes[Math.floor(R() * foes.length)];
        if (R() < d.dodge) { log.push({ t: 'atk', a: a.i, d: d.i, dmg: 0, miss: true, hp: d.hp }); continue; }
        const crit = R() < a.crit;
        const tm = typeMult(a.animal.cls, d.animal.cls);
        let dmg = a.atk * (0.75 + R() * 0.5) * tm;
        if (crit) dmg *= 1.8;
        dmg = Math.max(1, Math.round(dmg));
        d.hp = Math.max(0, d.hp - dmg);
        const ev = { t: 'atk', a: a.i, d: d.i, dmg, crit, hp: d.hp };
        if (tm > 1) ev.eff = 'up'; else if (tm < 1) ev.eff = 'down';
        log.push(ev);
        if (d.hp <= 0) { d.alive = false; koOrder.push(d.i); log.push({ t: 'ko', i: d.i, by: a.i }); }
      }
    }
    // time-out: remaining ranked by hp ratio
    const rest = alive().sort((x, y) => y.hp / y.maxHp - x.hp / x.maxHp).map(f => f.i);
    const placements = rest.concat(koOrder.slice().reverse());
    log.push({ t: 'end', placements });
    return {
      seed,
      fighters: F.map(f => ({ i: f.i, owner: f.owner, animal: f.animal, maxHp: f.maxHp, atk: Math.round(f.atk), spd: Math.round(f.spd) })),
      log,
      placements,
    };
  }

  // ---------- Prizes ----------
  const ROOM_PRIZES = { 1: [0], 2: [200, 50], 3: [300, 120, 40], 4: [400, 200, 100, 30] };
  const AI_LEVELS = [
    { id: 'easy',   ko: '쉬움',   diff: [-6, -2], reward: 60 },
    { id: 'normal', ko: '보통',   diff: [-1, 1],  reward: 120 },
    { id: 'hard',   ko: '어려움', diff: [2, 5],   reward: 250 },
    { id: 'hell',   ko: '지옥',   diff: [6, 12],  reward: 500 },
  ];
  const AI_LOSE_REWARD = 10;

  // ---------- Gacha ----------
  const GACHA = {
    cost1: 100,
    cost10: 1000,
    decay: 0.85,      // weight per animal = decay ^ power  → long names are rare
    pity: 50,         // every N pulls → Animal Pack
    packSize: 3,
    packMin: 20,      // pack animals have at least 20 letters
    dupRefund: 20,
  };

  // Build a sampler over a list of animals with weight decay^power.
  function sampler(list, decay) {
    const cum = new Float64Array(list.length);
    let s = 0;
    for (let i = 0; i < list.length; i++) { s += Math.pow(decay, list[i].power); cum[i] = s; }
    return {
      total: s,
      pick(r) {
        const x = r * s;
        let lo = 0, hi = cum.length - 1;
        while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; }
        return list[lo];
      },
    };
  }

  // Probability (in %) of a pull landing at >= each threshold
  function odds(list, decay, thresholds) {
    let T = 0; const acc = thresholds.map(() => 0);
    for (const a of list) {
      const w = Math.pow(decay, a.power); T += w;
      thresholds.forEach((th, k) => { if (a.power >= th) acc[k] += w; });
    }
    return acc.map(v => v / T * 100);
  }

  function glowOf(power) {
    if (power >= 25) return 'gold';
    if (power >= 20) return 'purple';
    if (power >= 10) return 'blue';
    return 'white';
  }

  return { TYPES, TYPE_UP, TYPE_DOWN, typeMult, rng, newSeed, stats, simulate, ROOM_PRIZES, AI_LEVELS, AI_LOSE_REWARD, GACHA, sampler, odds, glowOf };
});
