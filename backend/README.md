# SkySentry Go - Simplified WebSocket Streaming

A high-performance, ultra-simple WebSocket-based webcam streaming system built with Golang and in-memory ring buffers.

## 🚀 Architecture Overview

**Before (Complex):** `Camera → WebRTC → TypeScript Server → Redis → WebSocket → Viewer`
**Now (Simple):** `Camera → WebSocket → Golang Server (Ring Buffer) → WebSocket → Viewer`

## ⚡ Performance Benefits

- **No WebRTC complexity** - Direct WebSocket binary streaming
- **No Redis dependency** - In-memory ring buffers for ultra-low latency
- **Golang performance** - Concurrent, efficient server handling
- **Configurable ring buffers** - Default 16 frames per client (customizable)
- **Real-time broadcasting** - Instant frame distribution to all viewers

## 🏗️ Components

### 1. Golang Server (`backend/`)

- **WebSocket Server**: Handles capture clients on `ws://demo8080.shivi.io/ws`
- **Streaming Server**: Broadcasts to viewers on `ws://demo8080.shivi.io/stream/ws`
- **REST API**: HTTP endpoints on `https://demo8080.shivi.io/api/`
- **Ring Buffers**: In-memory circular buffers (16 frames default per client)
- **Auto Cleanup**: Removes inactive clients after 2 minutes

### 2. Capture Frontend (`capture/`)

- **Simple WebSocket Client**: Direct binary frame transmission
- **No WebRTC**: Removed all peer-to-peer complexity
- **Canvas Capture**: JPEG compression with quality control
- **Performance Monitoring**: Real-time FPS counter
- **Auto-reconnection**: Robust connection handling

### 3. Web Viewer (`web/`)

- **Real-time Streaming**: WebSocket connection for live updates
- **Performance Dashboard**: FPS monitoring per camera
- **Fallback API**: HTTP REST endpoints when WebSocket unavailable
- **Multi-camera Grid**: Responsive layout for multiple streams

## 🚀 Quick Start

### 1. Start Golang Server

```bash
cd backend
make start
# or manually: go run main.go
```

The server provides:

- **WebSocket Capture**: `ws://demo8080.shivi.io/ws`
- **WebSocket Streaming**: `ws://demo8080.shivi.io/stream/ws`
- **REST API**: `https://demo8080.shivi.io/api/`
- **Health Check**: `https://demo8080.shivi.io/api/health`

### 2. Start Capture Client

```bash
cd capture
bun install
bun run dev
```

Access at: `https://demo5173.shivi.io`

### 3. Start Web Viewer

```bash
cd web
bun install
bun run dev
```

Access at: `https://demo3000.shivi.io/stream`

## 📡 API Endpoints

### WebSocket

| Endpoint     | Purpose                    | Protocol                     |
| ------------ | -------------------------- | ---------------------------- |
| `/ws`        | Capture client connections | Binary frames + JSON control |
| `/stream/ws` | Viewer streaming           | Real-time frame broadcasts   |

### REST API

| Endpoint                   | Method | Description                      |
| -------------------------- | ------ | -------------------------------- |
| `/api/health`              | GET    | Server health and stats          |
| `/api/clients`             | GET    | List all connected clients       |
| `/api/clients/{id}/latest` | GET    | Latest frame for specific client |
| `/api/clients/{id}/stream` | GET    | All frames in ring buffer        |
| `/api/streams`             | GET    | All client streams               |

## 🎛️ Configuration

### Server Constants (in `main.go`)

```go
const (
    BUFFER_SIZE     = 16              // Ring buffer size per client
    MAX_FRAME_SIZE  = 5 * 1024 * 1024 // 5MB max frame size
    CLEANUP_INTERVAL = 30 * time.Second // Cleanup frequency
    CLIENT_TIMEOUT   = 2 * time.Minute  // Client timeout
)
```

### Client Configuration

```tsx
<SkySentryClient
  clientId="demo-client-001"
  serverUrl="ws://demo8080.shivi.io"
  autoStartCamera={true}
  frameRate={30}
/>
```

## 🔧 Development

### Backend (Golang)

```bash
cd backend

# Install dependencies
make deps

# Development with hot reload
make dev

# Build binary
make build

# Run tests
make test

# Format code
make fmt
```

### Frontend

```bash
cd capture
bun run dev    # Capture client
```

```bash
cd web
bun run dev    # Viewer dashboard
```

## 📊 Performance

### Memory Usage

- **Ring Buffer**: ~16 frames × ~50KB = ~800KB per client
- **Golang Efficiency**: Minimal memory overhead
- **No Database**: Zero persistence overhead

### Throughput

- **Binary WebSocket**: Direct JPEG transmission
- **Concurrent Handling**: Golang goroutines for each connection
- **Real-time Broadcasting**: Non-blocking frame distribution
- **Configurable Frame Rate**: 1-60 FPS support

### Latency

- **No WebRTC Negotiation**: Instant connection setup
- **No Database Queries**: Direct memory access
- **No Base64 Encoding**: Binary frame transmission
- **In-Memory Buffers**: Sub-millisecond frame access

## 🌟 Key Features

### Ring Buffer Management

- **Circular Buffer**: Oldest frames automatically overwritten
- **Thread-Safe**: Concurrent read/write with Go mutexes
- **Memory Efficient**: Fixed size per client
- **Fast Access**: O(1) latest frame retrieval

### Connection Handling

- **Auto Registration**: Clients self-register with unique IDs
- **Heartbeat Detection**: Automatic inactive client cleanup
- **Graceful Disconnection**: Proper resource cleanup
- **Reconnection Support**: Client-side auto-reconnect

### Streaming Protocol

- **Binary Frames**: Direct JPEG data transmission
- **JSON Control**: Registration and metadata messages
- **Real-time Broadcast**: Immediate frame distribution
- **Viewer Multiplexing**: Multiple viewers per stream

## 🐛 Troubleshooting

### Server Issues

```bash
# Check if server is running
curl https://demo8080.shivi.io/api/health

# View server logs
go run main.go

# Check connections
ss -tlnp | grep :8080
```

### Client Issues

1. **Camera Access**: Ensure HTTPS for production or localhost for development
2. **WebSocket Connection**: Check browser console for connection errors
3. **Frame Rate**: Lower FPS if CPU usage is high
4. **Network**: Use wired connection for stability

### Performance Tips

1. **Buffer Size**: Increase `BUFFER_SIZE` for longer frame history
2. **Frame Quality**: Adjust JPEG quality in capture client (0.1-1.0)
3. **Frame Rate**: Balance between smoothness and bandwidth
4. **Concurrent Clients**: Golang handles hundreds of clients efficiently

## 🔄 Migration from Old System

### What Was Removed

- ❌ **WebRTC**: Complex peer-to-peer negotiation
- ❌ **Redis**: External database dependency
- ❌ **TypeScript Server**: Node.js/Bun complexity
- ❌ **Base64 Encoding**: Unnecessary data inflation
- ❌ **Multiple Ports**: Single server handles everything

### What Was Simplified

- ✅ **Single WebSocket Connection**: Direct client-server communication
- ✅ **Binary Transmission**: Raw JPEG data streaming
- ✅ **In-Memory Storage**: Ring buffers instead of database
- ✅ **Golang Performance**: Native concurrency and efficiency
- ✅ **Unified Server**: One binary handles all functionality

## 📈 Scaling Considerations

### Horizontal Scaling

- **Load Balancer**: Distribute clients across multiple server instances
- **Shared State**: Consider Redis for multi-server deployments
- **Database**: Add persistence for frame history if needed

### Vertical Scaling

- **Memory**: ~1MB per active client (16 frames × 50KB average)
- **CPU**: Golang efficiently handles thousands of connections
- **Network**: Bandwidth scales with client count × frame rate × quality

This simplified architecture provides the same streaming functionality with significantly reduced complexity and improved performance!
