import { useState, useRef, useEffect } from 'react';

export default function ChatPanel({ messages, onSendMessage, unreadCount, onToggle }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    onToggle?.(next);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText('');
  };

  return (
    <div className="chat-anchor">
      {open && (
        <div className="chat-panel">
          <div className="chat-header">
            <span className="chat-title">Chat</span>
            <button className="chat-close" onClick={toggle}>&times;</button>
          </div>
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-empty">No messages yet</div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="chat-msg">
                <span className="chat-msg-name">{msg.playerName}</span>
                <span className="chat-msg-text">{msg.text}</span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <form className="chat-input-row" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              className="chat-input"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Type a message..."
              maxLength={200}
            />
            <button type="submit" className="chat-send">Send</button>
          </form>
        </div>
      )}
      <button
        className="btn chat-toggle"
        onClick={toggle}
        aria-label="Chat"
      >
        💬
        {!open && unreadCount > 0 && (
          <span className="chat-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>
    </div>
  );
}
