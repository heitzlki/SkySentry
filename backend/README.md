# SkySentry Backend

WebRTC signaling server using WebSockets.

## Setup

```bash
bun install
```

## Run

```bash
# Development mode (with hot reload)
bun run dev

# Production mode
bun start
```

The server will run on `ws://localhost:8080`

## What it does

- Acts as a WebRTC signaling server
- Relays offer/answer/ICE candidate messages between peers
- Logs all incoming WebRTC data channel messages
