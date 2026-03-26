const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const {
  createGame, addPlayer, removePlayer,
  dealHand, applyAction, advanceGame,
  roomView, addLog, canLateJoin, checkBlindIncrease,
} = require('./gameEngine');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 10000,
  pingTimeout: 5000,
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
  // Check if blinds need to increase before sending state
  checkBlindIncrease(game);
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

      if (g.phase === 'showdown') {
        scheduleAutoDeal(roomCode);
      } else {
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

// ─── Auto-Deal Timer ────────────────────────────────────────────────────────
const autoDealTimers = {};
const AUTO_DEAL_DELAY = 5000; // 5 seconds between hands

function scheduleAutoDeal(roomCode) {
  clearAutoDeal(roomCode);
  const game = rooms[roomCode];
  if (!game || game.gameOver) return;

  game.nextDealAt = Date.now() + AUTO_DEAL_DELAY;
  broadcastGameState(roomCode);

  autoDealTimers[roomCode] = setTimeout(() => {
    const g = rooms[roomCode];
    if (!g || g.phase !== 'showdown' || g.gameOver) return;

    // Remove busted players from future hands (they stay visible but can't play)
    const remaining = g.players.filter(p => p.chips > 0);
    if (remaining.length < 2) {
      g.gameOver = true;
      g.gameWinner = remaining[0]?.name || null;
      if (g.gameWinner) {
        addLog(g, `${g.gameWinner} wins the game!`);
      }
      broadcastGameState(roomCode);
      return;
    }

    dealHand(g);
    broadcastGameState(roomCode);
    startTurnTimer(roomCode);
  }, AUTO_DEAL_DELAY);
}

function clearAutoDeal(roomCode) {
  if (autoDealTimers[roomCode]) {
    clearTimeout(autoDealTimers[roomCode]);
    delete autoDealTimers[roomCode];
  }
  const game = rooms[roomCode];
  if (game) game.nextDealAt = null;
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
    if (game.players.length >= 9) return callback({ error: 'Room is full' });

    // Allow join during waiting phase OR during late-join window
    if (game.phase !== 'waiting' && !canLateJoin(game)) {
      return callback({ error: 'Late join window has closed' });
    }

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

    if (game.phase === 'showdown') {
      clearTurnTimer(meta.roomCode);
      scheduleAutoDeal(meta.roomCode);
    } else {
      startTurnTimer(meta.roomCode);
    }

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

  socket.on('chatMessage', ({ text }) => {
    const meta = socketMeta[socket.id];
    if (!meta) return;

    const game = rooms[meta.roomCode];
    if (!game) return;

    const player = game.players.find(p => p.id === meta.playerId);
    if (!player) return;

    const trimmed = text.trim().slice(0, 200);
    if (!trimmed) return;

    io.to(meta.roomCode).emit('chatMessage', {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      playerName: player.name,
      text: trimmed,
      ts: Date.now(),
    });
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
