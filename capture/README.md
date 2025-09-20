# SkySentry Frontend

React + Vite + TypeScript WebRTC client.

## Setup

```bash
bun install
```

## Run

```bash
bun run dev
```

The app will run on `http://localhost:5173`

## What it does

- Connects to WebRTC signaling server at `ws://localhost:8080`
- Establishes WebRTC data channel connection
- Sends "hi" message every second via WebRTC data channel (UDP-like)
- Displays connection status and message history

## Usage

1. Start the backend signaling server first
2. Start the frontend dev server
3. Open multiple browser tabs to test peer-to-peer communication
