import { useState } from 'react';

export default function ActionPanel({ gameState, me, onAction }) {
  const { currentBet, settings } = gameState;
  const callAmount = currentBet - me.bet;
  const canCheck = callAmount === 0;
  const minRaise = currentBet + settings.bigBlind;
  const [raiseAmount, setRaiseAmount] = useState(minRaise);

  const handleRaise = () => {
    if (raiseAmount > me.chips + me.bet) {
      onAction('allin');
    } else {
      onAction('raise', raiseAmount);
    }
  };

  return (
    <div className="action-panel">
      <button className="btn btn-fold" onClick={() => onAction('fold')}>
        Fold
      </button>

      {canCheck ? (
        <button className="btn btn-check" onClick={() => onAction('check')}>
          Check
        </button>
      ) : (
        <button className="btn btn-call" onClick={() => onAction('call')}>
          Call {callAmount}
        </button>
      )}

      <div className="raise-controls">
        <input
          type="range"
          min={minRaise}
          max={me.chips + me.bet}
          value={raiseAmount}
          onChange={e => setRaiseAmount(Number(e.target.value))}
          className="raise-slider"
        />
        <button className="btn btn-raise" onClick={handleRaise}>
          Raise to {raiseAmount}
        </button>
      </div>

      <button className="btn btn-allin" onClick={() => onAction('allin')}>
        All In ({me.chips})
      </button>
    </div>
  );
}
