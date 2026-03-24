import { useState } from 'react';

const EMOJIS = ['😂', '🔥', '😎', '👏', '😤', '💀', '🃏', '💰'];

export default function EmojiReactions({ reactions, onSendReaction }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating bubbles */}
      <div className="reaction-bubbles" style={{ pointerEvents: 'none' }}>
        {reactions.map((r) => (
          <div key={r.id} className="reaction-bubble">
            <span className="bubble-emoji">{r.emoji}</span>
            <span className="bubble-name">{r.playerName}</span>
          </div>
        ))}
      </div>

      {/* Picker */}
      <div className="reaction-picker-anchor">
        {open && (
          <div className="reaction-picker">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                className="reaction-btn"
                onClick={() => {
                  onSendReaction(emoji);
                  setOpen(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <button
          className="btn reaction-toggle"
          onClick={() => setOpen(!open)}
          aria-label="Reactions"
        >
          😄
        </button>
      </div>
    </>
  );
}
