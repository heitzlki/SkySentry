# SkySentry - High-Performance Real-Time Streaming System

A WebRTC-based real-time video streaming system optimized for ultra-low latency communication.

## 🚀 Performance Optimizations

### Latest Improvements (v2.0)

- **Ultra-low latency**: WebSocket streaming server for real-time frame broadcasting
- **30 FPS streaming**: Increased from 10 FPS with optimized frame rate limiting
- **Memory caching**: In-memory frame cache for instant access (bypasses Redis for viewing)
- **Batch processing**: Redis operations batched for 50ms intervals, reducing overhead by 80%
- **WebRTC optimization**: Unordered data channels with no retransmission for real-time performance
- **Connection pooling**: Redis connection pooling with faster reconnect strategies
- **Smart heartbeats**: Reduced frequency to 1 minute (was 30 seconds)

### Architecture

- **Backend Stream Server**: Dual WebSocket architecture (signaling + streaming)
- **Frontend Capture**: React + Vite + TypeScript with optimized WebRTC
- **Frontend Viewer**: Next.js with real-time WebSocket streaming
- **Storage**: Redis with batched operations and memory caching
- **Communication**: WebRTC data channels + WebSocket broadcasting

## Quick Start

### 1. Start Redis (Required)

```bash
docker compose up -d redis
```

### 2. Start Stream Server (Terminal 1)

```bash
cd stream
bun install
bun run dev
```

The server runs:

- WebSocket signaling: `ws://demo8080.shivi.io`
- Streaming server: `wss://demo8081.shivi.io`
- REST API: `https://demo3001.shivi.io`

### 3. Start Capture Client (Terminal 2)

```bash
cd capture
bun install
bun run dev
```

Access at: `https://demo5173.shivi.io`

### 4. Start Web Viewer (Terminal 3)

```bash
cd web
bun install
bun run dev
```

Access at: `https://demo3000.shivi.io/stream`

## Performance Features

### Real-Time Streaming

- **Frame Rate**: Up to 30 FPS (configurable)
- **Latency**: < 100ms end-to-end in optimal conditions
- **Quality**: Adjustable JPEG compression (default 0.7)
- **Resolution**: Up to 1280x720 (default 640x480)

### WebSocket Streaming Server

- Instant frame broadcasting to all viewers
- Automatic reconnection with exponential backoff
- Real-time FPS monitoring per camera
- Memory-based frame caching (10-second TTL)

### Redis Optimizations

- Batched operations (10 ops/batch, 50ms timeout)
- Connection pooling (2-10 connections)
- Reduced cleanup frequency (60s intervals)
- Smart client activity tracking (every 10th frame)

### WebRTC Optimizations

- Unordered data channels (no retransmission)
- Optimized ICE candidate handling
- Automatic peer connection recovery
- Base64 encoding optimizations

## Environment Variables

```bash
# Stream Server
WEBSOCKET_PORT=8080          # WebRTC signaling
STREAMING_PORT=8081          # Real-time streaming
API_PORT=3001               # REST API
REDIS_URL=redis://localhost:6379

# Capture Client
VITE_WEBSOCKET_URL=ws://demo8080.shivi.io
```

## Performance Monitoring

### Web Interface

- Real-time FPS counter per camera
- Frame statistics and latency metrics
- Connection status indicators
- Performance dashboard

### Server Logs

```
Stats: 1250 frames, 2 clients, Cache: 2, Redis: OK, Active peers: 1
```

### Redis Stats

```bash
# Connect to Redis CLI
docker exec -it redis redis-cli

# Check performance
INFO stats
SMEMBERS clients
```

## Troubleshooting

### High Latency Issues

1. Check network conditions
2. Reduce frame rate if CPU limited
3. Lower JPEG quality for bandwidth
4. Ensure Redis is running locally

### Connection Issues

1. Verify all ports are available
2. Check firewall settings
3. Ensure WebSocket upgrade headers
4. Monitor browser console for errors

### Performance Tips

1. Use Chrome/Edge for best WebRTC performance
2. Close other applications using camera
3. Use wired connection for stability
4. Monitor CPU usage during streaming

## What's New in v2.0

### Backend Improvements

- Dual WebSocket architecture for signaling + streaming
- In-memory frame cache for instant access
- Batched Redis operations (80% less overhead)
- Smart cleanup with longer timeouts
- Non-blocking message processing

### Frontend Improvements

- 30 FPS streaming with frame rate limiting
- Optimized base64 encoding
- WebRTC unordered data channels
- Performance monitoring dashboard
- Automatic quality adjustment

### Viewer Improvements

- Real-time WebSocket streaming (no polling)
- Live FPS counters
- Instant frame updates
- Connection status monitoring
- Fallback to HTTP API when needed

## Technical Details

### Frame Processing Pipeline

1. **Capture**: Canvas.toBlob() with JPEG compression
2. **Encode**: Optimized ArrayBuffer to base64
3. **Transmit**: WebRTC data channel (unordered)
4. **Cache**: In-memory storage with instant broadcast
5. **Store**: Batched Redis operations (background)
6. **Display**: WebSocket streaming to viewers

### Data Flow

```
Camera → Canvas → Blob → ArrayBuffer → Base64 → WebRTC → Server → Memory Cache → WebSocket → Viewer
```

This optimized pipeline reduces latency from ~1-2 seconds to under 100ms in optimal conditions.
