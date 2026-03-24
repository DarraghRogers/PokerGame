import { useState, useEffect } from 'react';
import Card from './Card';
import ActionPanel from './ActionPanel';

export default function GameTable({ gameState, playerId, me, isHost, onAction, onNextHand, onLeave }) {
  const { players, community, pot, phase, dealerSeat, actionSeat, log, timerEndsAt } = gameState;

  const isMyTurn = me && me.seatIndex === actionSeat && !me.folded && !me.allIn && phase !== 'showdown' && phase !== 'waiting';

  return (
    <div className="game-table">
      {/* Pot & Community Cards */}
      <div className="table-center">
        <div className="pot-display">
          <span className="pot-label">Pot</span>
          <span className="pot-amount">{pot}</span>
        </div>

        <div className="community-cards">
          {community.map((card, i) => (
            <Card key={i} card={card} />
          ))}
          {Array.from({ length: 5 - community.length }).map((_, i) => (
            <div key={`empty-${i}`} className="card card-placeholder" />
          ))}
        </div>

        <div className="phase-badge">{phase}</div>
      </div>

      {/* Player Seats */}
      <div className="seats">
        {players.map((player) => {
          const isMe = player.id === playerId;
          const isActive = player.seatIndex === actionSeat && phase !== 'showdown';
          const isDealer = player.seatIndex === dealerSeat;

          return (
            <div
              key={player.id}
              className={`seat ${isActive ? 'seat-active' : ''} ${player.folded ? 'seat-folded' : ''} ${!player.connected ? 'seat-disconnected' : ''} ${isMe ? 'seat-me' : ''}`}
            >
              <div className="seat-header">
                <span className="seat-name">{player.name}</span>
                {isDealer && <span className="dealer-chip">D</span>}
                {player.allIn && <span className="allin-badge">ALL IN</span>}
              </div>

              <div className="seat-cards">
                {player.holeCards.map((card, i) => (
                  <Card key={i} card={card} small />
                ))}
                {player.holeCards.length === 0 && !player.folded && phase !== 'waiting' && (
                  <>
                    <Card card={null} small />
                    <Card card={null} small />
                  </>
                )}
              </div>

              <div className="seat-info">
                <span className="seat-chips">{player.chips}</span>
                {player.bet > 0 && <span className="seat-bet">Bet: {player.bet}</span>}
              </div>

              {isActive && timerEndsAt && (
                <TimerBar endsAt={timerEndsAt} />
              )}
            </div>
          );
        })}
      </div>

      {/* My Hole Cards (large) */}
      {me && me.holeCards.length > 0 && (
        <div className="my-cards">
          <span className="my-cards-label">Your Hand</span>
          <div className="my-cards-row">
            {me.holeCards.map((card, i) => (
              <Card key={i} card={card} />
            ))}
          </div>
        </div>
      )}

      {/* Action Panel */}
      {isMyTurn && (
        <ActionPanel
          gameState={gameState}
          me={me}
          onAction={onAction}
        />
      )}

      {/* Game Log */}
      <div className="game-log">
        {log.slice(-8).map((entry, i) => (
          <div key={i} className="log-entry">{entry.msg}</div>
        ))}
      </div>

      <button className="btn btn-ghost btn-sm leave-btn" onClick={onLeave}>Leave</button>
    </div>
  );
}

function TimerBar({ endsAt }) {
  const [pct, setPct] = useState(100);

  useEffect(() => {
    const total = 30000;
    const interval = setInterval(() => {
      const remaining = Math.max(0, endsAt - Date.now());
      setPct((remaining / total) * 100);
    }, 100);
    return () => clearInterval(interval);
  }, [endsAt]);

  return (
    <div className="timer-bar">
      <div className="timer-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
