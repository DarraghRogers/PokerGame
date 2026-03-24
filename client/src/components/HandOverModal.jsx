import Card from './Card';

export default function HandOverModal({ winners, isHost, onNextHand }) {
  if (!winners || winners.length === 0) return null;

  const winner = winners[0];

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="modal-title">Hand Over</h2>

        <div className="winner-display">
          <span className="winner-name">{winner.name}</span>
          <span className="winner-result">wins {winner.chips}</span>
          {winner.hand && <span className="winner-hand">{winner.hand}</span>}
        </div>

        {winner.holeCards && (
          <div className="winner-cards">
            {winner.holeCards.map((card, i) => (
              <Card key={i} card={card} />
            ))}
          </div>
        )}

        {winners.length > 1 && (
          <div className="showdown-hands">
            <h3>Showdown</h3>
            {winners.slice(1).map((w) => (
              <div key={w.id} className="showdown-entry">
                <span className="showdown-name">{w.name}</span>
                {w.hand && <span className="showdown-hand">{w.hand}</span>}
                {w.holeCards && (
                  <div className="showdown-cards">
                    {w.holeCards.map((card, i) => (
                      <Card key={i} card={card} small />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {isHost && (
          <button className="btn btn-primary modal-btn" onClick={onNextHand}>
            Deal Next Hand
          </button>
        )}
        {!isHost && (
          <p className="waiting-hint">Waiting for host to deal...</p>
        )}
      </div>
    </div>
  );
}
