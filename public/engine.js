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
        let dmg = a.atk * (0.75 + R() * 0.5);
        if (crit) dmg *= 1.8;
        dmg = Math.max(1, Math.round(dmg));
        d.hp = Math.max(0, d.hp - dmg);
        log.push({ t: 'atk', a: a.i, d: d.i, dmg, crit, hp: d.hp });
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

  return { rng, newSeed, stats, simulate, ROOM_PRIZES, AI_LEVELS, AI_LOSE_REWARD, GACHA, sampler, odds, glowOf };
});
