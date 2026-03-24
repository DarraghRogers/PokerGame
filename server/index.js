const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const {
  createGame, addPlayer, removePlayer,
  dealHand, applyAction, advanceGame,
  roomView, addLog,
} = require('./gameEngine');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ─── In-memory room store ───────────────────────────────────────────────────
const rooms = {};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function broadcastGameState(roomCode) {
  const game = rooms[roomCode];
  if (!game) return;
  for (const player of game.players) {
    const socketId = playerSockets[player.id];
    if (socketId) {
      io.to(socketId).emit('gameState', roomView(game, player.id));
    }
  }
}

// Map playerId → socketId
const playerSockets = {};
// Map socketId → { playerId, roomCode }
const socketMeta = {};

// ─── Turn Timer ─────────────────────────────────────────────────────────────
const roomTimers = {};

function startTurnTimer(roomCode) {
  clearTurnTimer(roomCode);
  const game = rooms[roomCode];
  if (!game || game.phase === 'waiting' || game.phase === 'showdown') return;

  const timerMs = (game.settings.turnTimer || 30) * 1000;
  game.timerEndsAt = Date.now() + timerMs;

  roomTimers[roomCode] = setTimeout(() => {
    const g = rooms[roomCode];
    if (!g || g.phase === 'waiting' || g.phase === 'showdown') return;

    const player = g.players[g.actionSeat];
    if (player && !player.folded && !player.allIn) {
      applyAction(g, player.id, 'fold');
      addLog(g, `${player.name} timed out and auto-folded`);
      advanceGame(g);
      broadcastGameState(roomCode);

      if (g.phase !== 'showdown') {
        startTurnTimer(roomCode);
      }
    }
  }, timerMs);
}

function clearTurnTimer(roomCode) {
  if (roomTimers[roomCode]) {
    clearTimeout(roomTimers[roomCode]);
    delete roomTimers[roomCode];
  }
}

// ─── Socket Events ──────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on('createRoom', ({ playerName, settings }, callback) => {
    const roomCode = generateCode();
    const playerId = `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    rooms[roomCode] = createGame(roomCode, settings);
    addPlayer(rooms[roomCode], playerId, playerName);

    playerSockets[playerId] = socket.id;
    socketMeta[socket.id] = { playerId, roomCode };
    socket.join(roomCode);

    callback({ roomCode, playerId });
    broadcastGameState(roomCode);
  });

  socket.on('joinRoom', ({ roomCode, playerName }, callback) => {
    const game = rooms[roomCode];
    if (!game) return callback({ error: 'Room not found' });
    if (game.phase !== 'waiting') return callback({ error: 'Game already in progress' });
    if (game.players.length >= 9) return callback({ error: 'Room is full' });

    const playerId = `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    addPlayer(game, playerId, playerName);

    playerSockets[playerId] = socket.id;
    socketMeta[socket.id] = { playerId, roomCode };
    socket.join(roomCode);

    callback({ roomCode, playerId });
    broadcastGameState(roomCode);
  });

  socket.on('rejoinRoom', ({ playerId, roomCode }, callback) => {
    const game = rooms[roomCode];
    if (!game) return callback({ error: 'Room not found' });

    const player = game.players.find(p => p.id === playerId);
    if (!player) return callback({ error: 'Player not found in room' });

    player.connected = true;
    playerSockets[playerId] = socket.id;
    socketMeta[socket.id] = { playerId, roomCode };
    socket.join(roomCode);

    addLog(game, `${player.name} reconnected`);
    callback({ roomCode, playerId });
    broadcastGameState(roomCode);
  });

  socket.on('startGame', (_, callback) => {
    const meta = socketMeta[socket.id];
    if (!meta) return callback?.({ error: 'Not in a room' });

    const game = rooms[meta.roomCode];
    if (!game) return callback?.({ error: 'Room not found' });

    // Only host (first player) can start
    if (game.players[0]?.id !== meta.playerId) {
      return callback?.({ error: 'Only the host can start the game' });
    }
    if (game.players.length < 2) {
      return callback?.({ error: 'Need at least 2 players' });
    }

    dealHand(game);
    broadcastGameState(meta.roomCode);
    startTurnTimer(meta.roomCode);
    callback?.({ success: true });
  });

  socket.on('action', ({ action, amount }, callback) => {
    const meta = socketMeta[socket.id];
    if (!meta) return callback?.({ error: 'Not in a room' });

    const game = rooms[meta.roomCode];
    if (!game) return callback?.({ error: 'Room not found' });

    const result = applyAction(game, meta.playerId, action, amount);
    if (!result.valid) return callback?.({ error: result.reason });

    advanceGame(game);
    broadcastGameState(meta.roomCode);

    if (game.phase !== 'showdown') {
      startTurnTimer(meta.roomCode);
    } else {
      clearTurnTimer(meta.roomCode);
    }

    callback?.({ success: true });
  });

  socket.on('nextHand', (_, callback) => {
    const meta = socketMeta[socket.id];
    if (!meta) return callback?.({ error: 'Not in a room' });

    const game = rooms[meta.roomCode];
    if (!game) return callback?.({ error: 'Room not found' });
    if (game.phase !== 'showdown') return callback?.({ error: 'Hand is still in progress' });

    // Only host can deal next hand
    if (game.players[0]?.id !== meta.playerId) {
      return callback?.({ error: 'Only the host can deal the next hand' });
    }

    // Remove players with 0 chips
    const busted = game.players.filter(p => p.chips === 0);
    for (const p of busted) {
      addLog(game, `${p.name} is out of chips`);
    }

    const remaining = game.players.filter(p => p.chips > 0);
    if (remaining.length < 2) {
      addLog(game, `${remaining[0]?.name || 'Nobody'} wins the game!`);
      broadcastGameState(meta.roomCode);
      return callback?.({ error: 'Not enough players with chips to continue' });
    }

    dealHand(game);
    broadcastGameState(meta.roomCode);
    startTurnTimer(meta.roomCode);
    callback?.({ success: true });
  });

  socket.on('reaction', ({ emoji }) => {
    const meta = socketMeta[socket.id];
    if (!meta) return;

    const game = rooms[meta.roomCode];
    if (!game) return;

    const player = game.players.find(p => p.id === meta.playerId);
    if (!player) return;

    io.to(meta.roomCode).emit('reaction', { playerName: player.name, emoji });
  });

  socket.on('disconnect', () => {
    const meta = socketMeta[socket.id];
    if (!meta) return;

    const game = rooms[meta.roomCode];
    if (game) {
      const player = game.players.find(p => p.id === meta.playerId);
      if (player) {
        player.connected = false;
        addLog(game, `${player.name} disconnected`);

        // If it's their turn during an active hand, timer will auto-fold them
        broadcastGameState(meta.roomCode);
      }
    }

    delete playerSockets[meta.playerId];
    delete socketMeta[socket.id];
    console.log(`Disconnected: ${socket.id}`);
  });
});

// ─── Health check ───────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', rooms: Object.keys(rooms).length });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`The Table server running on port ${PORT}`);
});
