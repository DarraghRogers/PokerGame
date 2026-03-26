// ─── Card & Deck ────────────────────────────────────────────────────────────

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// ─── Hand Evaluator ─────────────────────────────────────────────────────────

function rankValue(rank) {
  const map = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };
  return map[rank];
}

function combinations(arr, k) {
  const result = [];
  function combine(start, combo) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      combine(i + 1, combo);
      combo.pop();
    }
  }
  combine(0, []);
  return result;
}

function scoreHand(cards) {
  const values = cards.map(c => rankValue(c.rank)).sort((a, b) => a - b);
  const suits = cards.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  let isStraight = false;
  let straightHigh = 0;

  // Normal straight check
  if (values[4] - values[0] === 4 && new Set(values).size === 5) {
    isStraight = true;
    straightHigh = values[4];
  }
  // Wheel: A-2-3-4-5
  if (values[0] === 2 && values[1] === 3 && values[2] === 4 && values[3] === 5 && values[4] === 14) {
    isStraight = true;
    straightHigh = 5;
  }

  // Count ranks
  const counts = {};
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
  }
  const groups = Object.entries(counts)
    .map(([val, cnt]) => ({ val: Number(val), cnt }))
    .sort((a, b) => b.cnt - a.cnt || b.val - a.val);

  // Royal Flush
  if (isFlush && isStraight && straightHigh === 14) {
    return { score: 9000000 + 14, name: 'Royal Flush' };
  }
  // Straight Flush
  if (isFlush && isStraight) {
    return { score: 8000000 + straightHigh, name: 'Straight Flush' };
  }
  // Four of a Kind
  if (groups[0].cnt === 4) {
    return { score: 7000000 + groups[0].val * 15 + groups[1].val, name: 'Four of a Kind' };
  }
  // Full House
  if (groups[0].cnt === 3 && groups[1].cnt === 2) {
    return { score: 6000000 + groups[0].val * 15 + groups[1].val, name: 'Full House' };
  }
  // Flush
  if (isFlush) {
    const flushScore = values[4]*15**4 + values[3]*15**3 + values[2]*15**2 + values[1]*15 + values[0];
    return { score: 5000000 + flushScore, name: 'Flush' };
  }
  // Straight
  if (isStraight) {
    return { score: 4000000 + straightHigh, name: 'Straight' };
  }
  // Three of a Kind
  if (groups[0].cnt === 3) {
    const kickers = groups.slice(1).map(g => g.val).sort((a, b) => b - a);
    return { score: 3000000 + groups[0].val * 15**2 + kickers[0]*15 + kickers[1], name: 'Three of a Kind' };
  }
  // Two Pair
  if (groups[0].cnt === 2 && groups[1].cnt === 2) {
    const pairs = [groups[0].val, groups[1].val].sort((a, b) => b - a);
    const kicker = groups[2].val;
    return { score: 2000000 + pairs[0]*15**2 + pairs[1]*15 + kicker, name: 'Two Pair' };
  }
  // One Pair
  if (groups[0].cnt === 2) {
    const kickers = groups.slice(1).map(g => g.val).sort((a, b) => b - a);
    return { score: 1000000 + groups[0].val*15**3 + kickers[0]*15**2 + kickers[1]*15 + kickers[2], name: 'One Pair' };
  }
  // High Card
  const hcScore = values[4]*15**4 + values[3]*15**3 + values[2]*15**2 + values[1]*15 + values[0];
  return { score: hcScore, name: 'High Card' };
}

function bestHand(cards) {
  const combos = combinations(cards, 5);
  let best = { score: -1, name: '', cards: [] };
  for (const combo of combos) {
    const result = scoreHand(combo);
    if (result.score > best.score) {
      best = { ...result, cards: combo };
    }
  }
  return best;
}

// ─── Game State ─────────────────────────────────────────────────────────────

function createGame(roomId, settings = {}) {
  return {
    roomId,
    phase: 'waiting',
    players: [],
    deck: [],
    community: [],
    pot: 0,
    currentBet: 0,
    dealerSeat: 0,
    actionSeat: 0,
    handNum: 0,
    settings: {
      startingChips: settings.startingChips || 1000,
      smallBlind: settings.smallBlind || 10,
      bigBlind: settings.bigBlind || 20,
      turnTimer: settings.turnTimer || 30,
      lateJoinWindow: settings.lateJoinWindow || 15,       // minutes
      blindIncreaseMinutes: Number(settings.blindIncreaseMinutes) >= 0 ? Number(settings.blindIncreaseMinutes) : 30, // minutes, 0 = disabled
    },
    log: [],
    timerEndsAt: null,
    winners: null,
    gameStartedAt: null,         // epoch ms — set when first hand is dealt
    nextDealAt: null,            // epoch ms — auto-deal countdown
    gameOver: false,             // true when only 1 player has chips
    gameWinner: null,            // name of overall winner
    blindLevel: 0,               // current blind escalation level
    nextBlindIncreaseAt: null,   // epoch ms
  };
}

function addPlayer(game, id, name) {
  if (game.players.length >= 9) return null;
  if (game.players.find(p => p.id === id)) return null;

  const seatIndex = game.players.length;
  const player = {
    id,
    name,
    chips: game.settings.startingChips,
    holeCards: [],
    bet: 0,
    folded: false,
    allIn: false,
    acted: false,
    seatIndex,
    connected: true,
  };
  game.players.push(player);
  addLog(game, `${name} joined the table`);
  return player;
}

function removePlayer(game, id) {
  const idx = game.players.findIndex(p => p.id === id);
  if (idx === -1) return;
  const player = game.players[idx];
  addLog(game, `${player.name} left the table`);
  game.players.splice(idx, 1);
  // Re-index seats
  game.players.forEach((p, i) => { p.seatIndex = i; });
}

function addLog(game, msg) {
  game.log.push({ msg, ts: Date.now() });
  if (game.log.length > 30) game.log.shift();
}

// ─── Late Join Check ────────────────────────────────────────────────────────

function canLateJoin(game) {
  if (game.phase === 'waiting') return true;
  if (!game.gameStartedAt) return false;
  const windowMs = game.settings.lateJoinWindow * 60 * 1000;
  return Date.now() - game.gameStartedAt < windowMs;
}

// ─── Blind Escalation ───────────────────────────────────────────────────────

function checkBlindIncrease(game) {
  const mins = Number(game.settings.blindIncreaseMinutes) || 0;
  if (mins <= 0) return false;
  if (!game.nextBlindIncreaseAt) return false;
  if (Date.now() < game.nextBlindIncreaseAt) return false;

  game.blindLevel++;
  const multiplier = game.blindLevel + 1;

  // Store originals on first increase
  if (!game.settings._baseSmallBlind) {
    game.settings._baseSmallBlind = game.settings.smallBlind;
    game.settings._baseBigBlind = game.settings.bigBlind;
  }

  const baseSB = game.settings._baseSmallBlind;
  const baseBB = game.settings._baseBigBlind;

  game.settings.smallBlind = baseSB * multiplier;
  game.settings.bigBlind = baseBB * multiplier;
  game.nextBlindIncreaseAt = Date.now() + mins * 60 * 1000;

  addLog(game, `Blinds increased to ${game.settings.smallBlind}/${game.settings.bigBlind}`);
  return true;
}

// ─── Deal & Blinds ──────────────────────────────────────────────────────────

function activePlayers(game) {
  return game.players.filter(p => p.chips > 0 || p.allIn);
}

function playersInHand(game) {
  return game.players.filter(p => !p.folded && p.holeCards.length > 0);
}

function nextSeat(game, seat, filterFn) {
  const n = game.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (seat + i) % n;
    if (filterFn(game.players[idx])) return idx;
  }
  return -1;
}

function dealHand(game) {
  // Check blind escalation before dealing
  checkBlindIncrease(game);

  // Set game start timestamp on first deal
  if (!game.gameStartedAt) {
    game.gameStartedAt = Date.now();
    if (game.settings.blindIncreaseMinutes > 0) {
      game.nextBlindIncreaseAt = Date.now() + game.settings.blindIncreaseMinutes * 60 * 1000;
    }
  }

  // Reset player state
  for (const p of game.players) {
    p.holeCards = [];
    p.bet = 0;
    p.folded = false;
    p.allIn = false;
    p.acted = false;
  }
  game.community = [];
  game.pot = 0;
  game.currentBet = 0;
  game.winners = null;
  game.nextDealAt = null;
  game.handNum++;

  // Move dealer
  if (game.handNum > 1) {
    game.dealerSeat = nextSeat(game, game.dealerSeat, p => p.chips > 0);
  }

  // Shuffle and deal
  game.deck = shuffle(createDeck());
  const eligible = game.players.filter(p => p.chips > 0);
  for (const p of eligible) {
    p.holeCards = [game.deck.pop(), game.deck.pop()];
  }

  // Post blinds
  const n = game.players.length;
  let sbSeat, bbSeat;

  if (eligible.length === 2) {
    // Heads-up: dealer is SB
    sbSeat = game.dealerSeat;
    bbSeat = nextSeat(game, sbSeat, p => p.chips > 0);
  } else {
    sbSeat = nextSeat(game, game.dealerSeat, p => p.chips > 0);
    bbSeat = nextSeat(game, sbSeat, p => p.chips > 0);
  }

  const sbPlayer = game.players[sbSeat];
  const bbPlayer = game.players[bbSeat];

  const sbAmount = Math.min(game.settings.smallBlind, sbPlayer.chips);
  sbPlayer.chips -= sbAmount;
  sbPlayer.bet = sbAmount;
  if (sbPlayer.chips === 0) sbPlayer.allIn = true;

  const bbAmount = Math.min(game.settings.bigBlind, bbPlayer.chips);
  bbPlayer.chips -= bbAmount;
  bbPlayer.bet = bbAmount;
  if (bbPlayer.chips === 0) bbPlayer.allIn = true;

  game.pot = sbAmount + bbAmount;
  game.currentBet = bbAmount;
  game.phase = 'preflop';

  // Action starts left of BB
  game.actionSeat = nextSeat(game, bbSeat, p => !p.folded && !p.allIn && p.holeCards.length > 0);

  addLog(game, `Hand #${game.handNum} dealt`);
  addLog(game, `${sbPlayer.name} posts small blind (${sbAmount})`);
  addLog(game, `${bbPlayer.name} posts big blind (${bbAmount})`);

  return game;
}

// ─── Actions ────────────────────────────────────────────────────────────────

function applyAction(game, playerId, action, amount = 0) {
  const player = game.players.find(p => p.id === playerId);
  if (!player) return { valid: false, reason: 'Player not found' };
  if (player.seatIndex !== game.actionSeat) return { valid: false, reason: 'Not your turn' };
  if (player.folded || player.allIn) return { valid: false, reason: 'Cannot act' };

  switch (action) {
    case 'fold':
      player.folded = true;
      player.acted = true;
      addLog(game, `${player.name} folds`);
      break;

    case 'check':
      if (player.bet < game.currentBet) {
        return { valid: false, reason: 'Cannot check, must call or raise' };
      }
      player.acted = true;
      addLog(game, `${player.name} checks`);
      break;

    case 'call': {
      const callAmount = Math.min(game.currentBet - player.bet, player.chips);
      player.chips -= callAmount;
      player.bet += callAmount;
      game.pot += callAmount;
      player.acted = true;
      if (player.chips === 0) {
        player.allIn = true;
        addLog(game, `${player.name} calls ${callAmount} (all-in)`);
      } else {
        addLog(game, `${player.name} calls ${callAmount}`);
      }
      break;
    }

    case 'raise': {
      const raiseTotal = amount;
      if (raiseTotal <= game.currentBet) {
        return { valid: false, reason: 'Raise must be higher than current bet' };
      }
      const needed = raiseTotal - player.bet;
      if (needed > player.chips) {
        return { valid: false, reason: 'Not enough chips' };
      }
      player.chips -= needed;
      player.bet = raiseTotal;
      game.pot += needed;
      game.currentBet = raiseTotal;
      player.acted = true;

      // Reopen action for all other active players
      for (const p of game.players) {
        if (p.id !== playerId && !p.folded && !p.allIn && p.holeCards.length > 0) {
          p.acted = false;
        }
      }

      if (player.chips === 0) {
        player.allIn = true;
        addLog(game, `${player.name} raises to ${raiseTotal} (all-in)`);
      } else {
        addLog(game, `${player.name} raises to ${raiseTotal}`);
      }
      break;
    }

    case 'allin': {
      const allInAmount = player.chips;
      const newBet = player.bet + allInAmount;
      player.chips = 0;
      game.pot += allInAmount;
      player.allIn = true;
      player.acted = true;

      if (newBet > game.currentBet) {
        game.currentBet = newBet;
        // Reopen action
        for (const p of game.players) {
          if (p.id !== playerId && !p.folded && !p.allIn && p.holeCards.length > 0) {
            p.acted = false;
          }
        }
        addLog(game, `${player.name} goes all-in for ${allInAmount} (total: ${newBet})`);
      } else {
        addLog(game, `${player.name} goes all-in for ${allInAmount}`);
      }
      player.bet = newBet;
      break;
    }

    default:
      return { valid: false, reason: 'Unknown action' };
  }

  return { valid: true };
}

// ─── Advance Game ───────────────────────────────────────────────────────────

function advanceGame(game) {
  const active = game.players.filter(p => !p.folded && p.holeCards.length > 0);

  // Only one player left — they win
  if (active.length === 1) {
    const winner = active[0];
    winner.chips += game.pot;
    game.winners = [{ id: winner.id, name: winner.name, chips: game.pot, hand: null }];
    game.phase = 'showdown';
    addLog(game, `${winner.name} wins ${game.pot} (everyone else folded)`);
    game.pot = 0;
    game.timerEndsAt = null;
    checkGameOver(game);
    return game;
  }

  // Check if betting round is complete
  const canAct = active.filter(p => !p.allIn);
  const allActed = canAct.every(p => p.acted);
  const allMatched = canAct.every(p => p.bet === game.currentBet || p.allIn);

  if (allActed && allMatched) {
    advancePhase(game);
  } else {
    // Move to next player
    game.actionSeat = nextSeat(game, game.actionSeat, p => !p.folded && !p.allIn && p.holeCards.length > 0);
  }

  return game;
}

function advancePhase(game) {
  const phases = ['preflop', 'flop', 'turn', 'river', 'showdown'];
  const currentIdx = phases.indexOf(game.phase);

  // Reset street bets
  for (const p of game.players) {
    p.bet = 0;
    p.acted = false;
  }
  game.currentBet = 0;

  const nextPhase = phases[currentIdx + 1];
  game.phase = nextPhase;

  switch (nextPhase) {
    case 'flop':
      game.deck.pop(); // burn
      game.community.push(game.deck.pop(), game.deck.pop(), game.deck.pop());
      addLog(game, `Flop: ${game.community.map(c => c.rank + c.suit[0]).join(' ')}`);
      break;
    case 'turn':
      game.deck.pop(); // burn
      game.community.push(game.deck.pop());
      addLog(game, `Turn: ${game.community[3].rank}${game.community[3].suit[0]}`);
      break;
    case 'river':
      game.deck.pop(); // burn
      game.community.push(game.deck.pop());
      addLog(game, `River: ${game.community[4].rank}${game.community[4].suit[0]}`);
      break;
    case 'showdown':
      resolveShowdown(game);
      return;
  }

  // Check if all remaining players are all-in — run out the board
  const canAct = game.players.filter(p => !p.folded && !p.allIn && p.holeCards.length > 0);
  if (canAct.length <= 1) {
    // Skip straight to next phase
    advancePhase(game);
    return;
  }

  // Set action to first active player left of dealer
  game.actionSeat = nextSeat(game, game.dealerSeat, p => !p.folded && !p.allIn && p.holeCards.length > 0);
}

function resolveShowdown(game) {
  const active = game.players.filter(p => !p.folded && p.holeCards.length > 0);
  const results = active.map(p => {
    const allCards = [...p.holeCards, ...game.community];
    const best = bestHand(allCards);
    return { id: p.id, name: p.name, score: best.score, handName: best.name, bestCards: best.cards, holeCards: p.holeCards };
  }).sort((a, b) => b.score - a.score);

  // Winner gets the pot
  const winner = game.players.find(p => p.id === results[0].id);
  winner.chips += game.pot;

  game.winners = results.map(r => ({
    id: r.id,
    name: r.name,
    chips: r.id === results[0].id ? game.pot : 0,
    hand: r.handName,
    holeCards: r.holeCards,
  }));

  addLog(game, `${results[0].name} wins ${game.pot} with ${results[0].handName}`);
  game.pot = 0;
  game.timerEndsAt = null;
  game.phase = 'showdown';

  checkGameOver(game);
}

// ─── Game Over Check ────────────────────────────────────────────────────────

function checkGameOver(game) {
  // Remove busted players
  const busted = game.players.filter(p => p.chips === 0);
  for (const p of busted) {
    addLog(game, `${p.name} is out of chips`);
  }

  const remaining = game.players.filter(p => p.chips > 0);
  if (remaining.length < 2) {
    game.gameOver = true;
    game.gameWinner = remaining[0]?.name || null;
    if (game.gameWinner) {
      addLog(game, `${game.gameWinner} wins the game!`);
    }
  }
}

// ─── Room View (privacy filter) ─────────────────────────────────────────────

function roomView(game, playerId) {
  const view = {
    ...game,
    players: game.players.map(p => {
      const isMe = p.id === playerId;
      const isShowdown = game.phase === 'showdown' && game.winners;
      return {
        ...p,
        holeCards: (isMe || isShowdown) ? p.holeCards : p.holeCards.map(() => null),
      };
    }),
    deck: undefined, // never send deck to client
  };
  delete view.deck;
  return view;
}

module.exports = {
  createGame,
  addPlayer,
  removePlayer,
  dealHand,
  applyAction,
  advanceGame,
  roomView,
  addLog,
  canLateJoin,
  checkBlindIncrease,
};
