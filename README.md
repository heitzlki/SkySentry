# SkySentry

Simple WebRTC system with React frontend and Node.js backend using Bun.

## Architecture

- **Backend**: WebSocket signaling server for WebRTC peer connection setup
- **Frontend**: React + Vite + TypeScript client with WebRTC data channels
- **Communication**: UDP-like messaging via WebRTC data channels

## Quick Start

### 1. Start Backend (Terminal 1)

```bash
cd backend
bun install
bun run dev
```

### 2. Start Frontend (Terminal 2)

```bash
cd frontend
bun install
bun run dev
```

### 3. Open Browser

- Navigate to `http://localhost:5173`
- Open multiple tabs to test peer-to-peer communication
- Watch the console for WebRTC connection logs

## What it does

The system sends a "hi" message every second from the frontend to the backend via WebRTC data channels, providing UDP-like real-time communication suitable for applications requiring low-latency data transmission.

## Project Structure

```
SkySentry/
├── backend/          # WebRTC signaling server
│   ├── index.ts      # Main server file
│   └── package.json  # Dependencies & scripts
├── frontend/         # React WebRTC client
│   ├── src/
│   │   ├── App.tsx              # Main app component
│   │   └── WebRTCComponent.tsx  # WebRTC logic
│   └── package.json  # Dependencies & scripts
└── README.md         # This file
```
