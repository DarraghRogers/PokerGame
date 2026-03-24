import { useState } from 'react';

export default function Lobby({ onCreateRoom, onJoinRoom }) {
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [startingChips, setStartingChips] = useState(1000);
  const [smallBlind, setSmallBlind] = useState(10);
  const [bigBlind, setBigBlind] = useState(20);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateRoom(name.trim(), { startingChips, smallBlind, bigBlind });
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!name.trim() || !joinCode.trim()) return;
    onJoinRoom(joinCode.trim(), name.trim());
  };

  return (
    <div className="lobby">
      <div className="lobby-hero">
        <h2 className="lobby-subtitle">Texas Hold'em</h2>
        <p className="lobby-desc">Play poker with friends from any device</p>
      </div>

      {!mode && (
        <div className="lobby-buttons">
          <button className="btn btn-primary" onClick={() => setMode('create')}>
            Create Room
          </button>
          <button className="btn btn-secondary" onClick={() => setMode('join')}>
            Join Room
          </button>
        </div>
      )}

      {mode === 'create' && (
        <form className="lobby-form" onSubmit={handleCreate}>
          <h3>Create a New Room</h3>
          <label>
            <span>Your Name</span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={16}
              autoFocus
            />
          </label>
          <label>
            <span>Starting Chips</span>
            <input
              type="number"
              value={startingChips}
              onChange={e => setStartingChips(Number(e.target.value))}
              min={100}
              max={100000}
            />
          </label>
          <div className="lobby-blinds">
            <label>
              <span>Small Blind</span>
              <input
                type="number"
                value={smallBlind}
                onChange={e => setSmallBlind(Number(e.target.value))}
                min={1}
              />
            </label>
            <label>
              <span>Big Blind</span>
              <input
                type="number"
                value={bigBlind}
                onChange={e => setBigBlind(Number(e.target.value))}
                min={2}
              />
            </label>
          </div>
          <div className="lobby-form-actions">
            <button type="submit" className="btn btn-primary">Create</button>
            <button type="button" className="btn btn-ghost" onClick={() => setMode(null)}>Back</button>
          </div>
        </form>
      )}

      {mode === 'join' && (
        <form className="lobby-form" onSubmit={handleJoin}>
          <h3>Join a Room</h3>
          <label>
            <span>Your Name</span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={16}
              autoFocus
            />
          </label>
          <label>
            <span>Room Code</span>
            <input
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g. ABC12"
              maxLength={5}
              className="input-code"
            />
          </label>
          <div className="lobby-form-actions">
            <button type="submit" className="btn btn-primary">Join</button>
            <button type="button" className="btn btn-ghost" onClick={() => setMode(null)}>Back</button>
          </div>
        </form>
      )}
    </div>
  );
}
