import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import Lobby from './components/Lobby';
import WaitingRoom from './components/WaitingRoom';
import GameTable from './components/GameTable';
import HandOverModal from './components/HandOverModal';
import EmojiReactions from './components/EmojiReactions';
import ChatPanel from './components/ChatPanel';
import ConfirmDialog from './components/ConfirmDialog';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';

export default function App() {
  const socketRef = useRef(null);
  const [screen, setScreen] = useState('lobby'); // lobby | waiting | game
  const [gameState, setGameState] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [roomCode, setRoomCode] = useState(null);
  const [error, setError] = useState(null);
  const [reactions, setReactions] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatUnread, setChatUnread] = useState(0);
  const chatOpenRef = useRef(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on('gameState', (state) => {
      setGameState(state);
      if (state.phase === 'waiting') {
        setScreen('waiting');
      } else {
        setScreen('game');
      }
    });

    socket.on('reaction', ({ playerName, emoji }) => {
      const id = Date.now() + Math.random();
      setReactions(prev => [...prev, { id, playerName, emoji }]);
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== id));
      }, 2800);
    });

    socket.on('chatMessage', (msg) => {
      setChatMessages(prev => [...prev.slice(-99), msg]);
      if (!chatOpenRef.current) {
        setChatUnread(prev => prev + 1);
      }
    });

    // On reconnect, automatically rejoin the room
    socket.on('connect', () => {
      const saved = localStorage.getItem('the-table-session');
      if (saved) {
        const { playerId: savedId, roomCode: savedRoom } = JSON.parse(saved);
        socket.emit('rejoinRoom', { playerId: savedId, roomCode: savedRoom }, (res) => {
          if (res.error) {
            localStorage.removeItem('the-table-session');
          } else {
            setPlayerId(savedId);
            setRoomCode(savedRoom);
          }
        });
      }
    });

    return () => socket.disconnect();
  }, []);

  const saveSession = useCallback((pid, code) => {
    setPlayerId(pid);
    setRoomCode(code);
    localStorage.setItem('the-table-session', JSON.stringify({ playerId: pid, roomCode: code }));
  }, []);

  const createRoom = useCallback((playerName, settings) => {
    setError(null);
    socketRef.current.emit('createRoom', { playerName, settings }, (res) => {
      if (res.error) return setError(res.error);
      saveSession(res.playerId, res.roomCode);
    });
  }, [saveSession]);

  const joinRoom = useCallback((code, playerName) => {
    setError(null);
    socketRef.current.emit('joinRoom', { roomCode: code.toUpperCase(), playerName }, (res) => {
      if (res.error) return setError(res.error);
      saveSession(res.playerId, res.roomCode);
    });
  }, [saveSession]);

  const startGame = useCallback(() => {
    socketRef.current.emit('startGame', null, (res) => {
      if (res?.error) setError(res.error);
    });
  }, []);

  const sendAction = useCallback((action, amount) => {
    socketRef.current.emit('action', { action, amount }, (res) => {
      if (res?.error) setError(res.error);
    });
  }, []);

  const sendReaction = useCallback((emoji) => {
    socketRef.current.emit('reaction', { emoji });
  }, []);

  const sendChatMessage = useCallback((text) => {
    socketRef.current.emit('chatMessage', { text });
  }, []);

  const handleChatToggle = useCallback((isOpen) => {
    chatOpenRef.current = isOpen;
    if (isOpen) setChatUnread(0);
  }, []);

  const doLeave = useCallback(() => {
    localStorage.removeItem('the-table-session');
    setScreen('lobby');
    setGameState(null);
    setPlayerId(null);
    setRoomCode(null);
    setShowLeaveConfirm(false);
    window.location.reload();
  }, []);

  const requestLeave = useCallback(() => {
    setShowLeaveConfirm(true);
  }, []);

  const isHost = gameState?.players?.[0]?.id === playerId;
  const me = gameState?.players?.find(p => p.id === playerId);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">The Table</h1>
        {roomCode && <span className="room-badge">Room: {roomCode}</span>}
      </header>

      {error && (
        <div className="error-banner" onClick={() => setError(null)}>
          {error} <span className="error-dismiss">&times;</span>
        </div>
      )}

      {screen === 'lobby' && (
        <Lobby onCreateRoom={createRoom} onJoinRoom={joinRoom} />
      )}

      {screen === 'waiting' && gameState && (
        <WaitingRoom
          gameState={gameState}
          roomCode={roomCode}
          isHost={isHost}
          onStartGame={startGame}
          onLeave={requestLeave}
        />
      )}

      {screen === 'game' && gameState && (
        <>
          <GameTable
            gameState={gameState}
            playerId={playerId}
            me={me}
            isHost={isHost}
            onAction={sendAction}
            onLeave={requestLeave}
          />
          {gameState.phase === 'showdown' && gameState.winners && (
            <HandOverModal
              gameState={gameState}
              winners={gameState.winners}
              onLeave={requestLeave}
            />
          )}
        </>
      )}

      {screen === 'game' && (
        <EmojiReactions reactions={reactions} onSendReaction={sendReaction} />
      )}

      {(screen === 'waiting' || screen === 'game') && (
        <ChatPanel
          messages={chatMessages}
          onSendMessage={sendChatMessage}
          unreadCount={chatUnread}
          onToggle={handleChatToggle}
        />
      )}

      {showLeaveConfirm && (
        <ConfirmDialog
          message="Are you sure you want to leave?"
          onConfirm={doLeave}
          onCancel={() => setShowLeaveConfirm(false)}
        />
      )}
    </div>
  );
}
