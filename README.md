# The Table — Texas Hold'em Poker

A real-time multiplayer Texas Hold'em poker web app for friends. Up to 9 players per room, shareable join codes, full betting engine, and live emoji reactions.

## Tech Stack

- **Server**: Node.js 22 + Express 4 + Socket.io 4
- **Client**: React 18 + Vite 4
- **Deployment**: Railway

## Getting Started

```bash
# Install all dependencies
npm run install:all

# Terminal 1 — server on :3001
npm run dev:server

# Terminal 2 — client on :5173
npm run dev:client
```

## Project Structure

```
the-table/
├── server/
│   ├── index.js          # Room management, socket events, turn timer
│   ├── gameEngine.js     # Deck, hand evaluator, game state logic
│   └── package.json
├── client/
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── App.css
│       └── components/
│           ├── Lobby.jsx
│           ├── WaitingRoom.jsx
│           ├── GameTable.jsx
│           ├── ActionPanel.jsx
│           ├── HandOverModal.jsx
│           ├── EmojiReactions.jsx
│           └── Card.jsx
└── package.json
```
