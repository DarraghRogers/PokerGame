export default function WaitingRoom({ gameState, roomCode, isHost, onStartGame, onLeave }) {
  const players = gameState.players || [];

  return (
    <div className="waiting-room">
      <div className="waiting-code-card">
        <span className="waiting-label">Room Code</span>
        <span className="waiting-code">{roomCode}</span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigator.clipboard?.writeText(roomCode)}
        >
          Copy
        </button>
      </div>

      <div className="waiting-players">
        <h3>Players ({players.length}/9)</h3>
        <ul className="player-list">
          {players.map((p, i) => (
            <li key={p.id} className="player-list-item">
              <span className="player-name">{p.name}</span>
              {i === 0 && <span className="host-badge">Host</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="waiting-actions">
        {isHost && (
          <button
            className="btn btn-primary"
            onClick={onStartGame}
            disabled={players.length < 2}
          >
            {players.length < 2 ? 'Waiting for players...' : 'Deal First Hand'}
          </button>
        )}
        {!isHost && (
          <p className="waiting-hint">Waiting for the host to start...</p>
        )}
        <button className="btn btn-ghost" onClick={onLeave}>Leave</button>
      </div>

      <div className="waiting-settings">
        <h4>Game Settings</h4>
        <div className="settings-grid">
          <span>Starting Chips</span><span>{gameState.settings.startingChips}</span>
          <span>Small Blind</span><span>{gameState.settings.smallBlind}</span>
          <span>Big Blind</span><span>{gameState.settings.bigBlind}</span>
          <span>Turn Timer</span><span>{gameState.settings.turnTimer}s</span>
        </div>
      </div>
    </div>
  );
}
