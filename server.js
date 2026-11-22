// The Longer The Stronger — game server (static files + multiplayer rooms)
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const compression = require('compression');
const { Server } = require('socket.io');
const Engine = require('./public/engine.js');

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 4;
const STEP_MS = 650; // must match client playback speed x1 (used to estimate battle length)

const DB = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'animals.json'), 'utf8'));
const BY_ID = new Map(DB.animals.map(a => [a.id, a]));

const app = express();
app.use(compression());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.get('/healthz', (_, res) => res.send('ok'));
const server = http.createServer(app);
const io = new Server(server);

const rooms = new Map(); // code -> room

function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do { c = Array.from({ length: 5 }, () => A[Math.floor(Math.random() * A.length)]).join(''); } while (rooms.has(c));
  return c;
}
const cleanName = n => String(n || '').trim().slice(0, 12) || '익명';

function publicRoom(r) {
  return {
    code: r.code,
    host: r.host,
    state: r.state,
    max: MAX_PLAYERS,
    players: [...r.players.values()].map(p => ({
      id: p.id, name: p.name, ready: p.ready,
      animal: p.animalId != null ? BY_ID.get(p.animalId) || null : null,
    })),
  };
}
const broadcast = r => io.to(r.code).emit('room:update', publicRoom(r));

function leave(socket) {
  const code = socket.data.room;
  if (!code) return;
  const r = rooms.get(code);
  socket.leave(code);
  socket.data.room = null;
  if (!r) return;
  r.players.delete(socket.id);
  if (!r.players.size) { clearTimeout(r.timer); rooms.delete(code); return; }
  if (r.host === socket.id) r.host = r.players.keys().next().value;
  broadcast(r);
}

io.on('connection', socket => {
  socket.on('room:create', ({ name } = {}, ack = () => {}) => {
    leave(socket);
    const code = makeCode();
    const r = { code, host: socket.id, state: 'lobby', players: new Map(), timer: null };
    rooms.set(code, r);
    r.players.set(socket.id, { id: socket.id, name: cleanName(name), animalId: null, ready: false });
    socket.join(code); socket.data.room = code;
    ack({ ok: true, code, me: socket.id });
    broadcast(r);
  });

  socket.on('room:join', ({ code, name } = {}, ack = () => {}) => {
    code = String(code || '').trim().toUpperCase();
    const r = rooms.get(code);
    if (!r) return ack({ ok: false, error: '방을 찾을 수 없어요.' });
    if (r.players.size >= MAX_PLAYERS && !r.players.has(socket.id)) return ack({ ok: false, error: '방이 가득 찼어요 (최대 4명).' });
    if (r.state !== 'lobby') return ack({ ok: false, error: '배틀이 진행 중이에요. 잠시 후 다시 시도하세요.' });
    leave(socket);
    r.players.set(socket.id, { id: socket.id, name: cleanName(name), animalId: null, ready: false });
    socket.join(code); socket.data.room = code;
    ack({ ok: true, code, me: socket.id });
    broadcast(r);
  });

  socket.on('room:leave', () => leave(socket));

  socket.on('room:pick', ({ animalId } = {}) => {
    const r = rooms.get(socket.data.room);
    if (!r || r.state !== 'lobby') return;
    const p = r.players.get(socket.id);
    if (!p || !BY_ID.has(animalId)) return;
    p.animalId = animalId; p.ready = true;
    broadcast(r);
  });

  socket.on('room:start', (_, ack = () => {}) => {
    const r = rooms.get(socket.data.room);
    if (!r) return ack({ ok: false, error: '방이 없어요.' });
    if (r.host !== socket.id) return ack({ ok: false, error: '방장만 시작할 수 있어요.' });
    if (r.state !== 'lobby') return ack({ ok: false, error: '이미 배틀 중이에요.' });
    const ps = [...r.players.values()];
    if (ps.length < 2) return ack({ ok: false, error: '2명 이상 필요해요.' });
    if (ps.some(p => p.animalId == null)) return ack({ ok: false, error: '모든 플레이어가 출전 동물을 골라야 해요.' });

    const fighters = ps.map(p => ({ owner: { id: p.id, name: p.name }, animal: BY_ID.get(p.animalId) }));
    const result = Engine.simulate(fighters);
    const table = Engine.ROOM_PRIZES[ps.length];
    const prizes = {};
    result.placements.forEach((fi, place) => { prizes[result.fighters[fi].owner.id] = { place: place + 1, coins: table[place] || 0 }; });
    const battleId = `${r.code}-${Date.now()}`;
    r.state = 'battle';
    io.to(r.code).emit('battle:start', { battleId, ...result, prizes });
    broadcast(r);
    ack({ ok: true });
    // room returns to lobby after the battle has had time to play out
    r.timer = setTimeout(() => {
      r.state = 'lobby';
      broadcast(r);
    }, Math.min(result.log.length * STEP_MS + 4000, 120000));
  });

  socket.on('disconnect', () => leave(socket));
});

server.listen(PORT, () => console.log(`The Longer The Stronger → http://localhost:${PORT}`));
