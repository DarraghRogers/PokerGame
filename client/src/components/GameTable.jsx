import { useState, useEffect } from 'react';
import Card from './Card';
import ActionPanel from './ActionPanel';

export default function GameTable({ gameState, playerId, me, isHost, onAction, onLeave }) {
  const { players, community, pot, phase, dealerSeat, actionSeat, log, timerEndsAt, nextDealAt, settings, nextBlindIncreaseAt } = gameState;

  const isMyTurn = me && me.seatIndex === actionSeat && !me.folded && !me.allIn && phase !== 'showdown' && phase !== 'waiting';

  return (
    <div className="game-table">
      {/* Pot & Community Cards */}
      <div className="table-center">
        <div className="table-info-row">
          <div className="pot-display">
            <span className="pot-label">Pot</span>
            <span className="pot-amount">{pot}</span>
          </div>
          <div className="blinds-display">
            <span className="blinds-label">Blinds</span>
            <span className="blinds-amount">{settings.smallBlind}/{settings.bigBlind}</span>
          </div>
        </div>

        {nextBlindIncreaseAt && (
          <BlindTimer endsAt={nextBlindIncreaseAt} />
        )}

        <div className="community-cards">
          {community.map((card, i) => (
            <Card key={i} card={card} />
          ))}
          {Array.from({ length: 5 - community.length }).map((_, i) => (
            <div key={`empty-${i}`} className="card card-placeholder" />
          ))}
        </div>

        <div className="phase-badge">{phase}</div>

        {phase === 'showdown' && nextDealAt && (
          <AutoDealCountdown endsAt={nextDealAt} />
        )}
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

      <button className="btn btn-leave leave-btn" onClick={onLeave}>Leave</button>
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

function AutoDealCountdown({ endsAt }) {
  const [seconds, setSeconds] = useState(5);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setSeconds(remaining);
    }, 200);
    return () => clearInterval(interval);
  }, [endsAt]);

  return (
    <div className="auto-deal-countdown">
      Next hand in {seconds}s
    </div>
  );
}

function formatBlindTime(endsAt) {
  const diff = Math.max(0, endsAt - Date.now());
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function BlindTimer({ endsAt }) {
  const [timeLeft, setTimeLeft] = useState(() => formatBlindTime(endsAt));

  useEffect(() => {
    setTimeLeft(formatBlindTime(endsAt));
    const interval = setInterval(() => {
      setTimeLeft(formatBlindTime(endsAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  if (timeLeft === '0:00') return null;

  return (
    <div className="blind-timer">
      <span className="blind-timer-label">Next blind increase</span>
      <span className="blind-timer-value">{timeLeft}</span>
    </div>
  );
}
