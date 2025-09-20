# Redis Storage - TL;DR

SkySentry uses Redis to track WebRTC clients and store their latest webcam frames.

## Quick Start

```bash
# Start Redis
docker compose up -d redis

# Optional: Redis GUI at localhost:5540
docker compose up -d redis-insight
```

## Data Structure

### Client Tracking

- **`clients`** (set) - List of active client IDs
- **`client:{id}`** (hash) - Client metadata (connected_at, last_seen, status)
- **`image:{id}`** (hash) - Latest webcam frame (base64 data, size, format, timestamp)

## Key Features

- **Auto-cleanup**: Removes inactive clients after 5 seconds
- **Latest frame only**: Each client stores one current image (overwrites old)
- **Client-provided IDs**: Backend uses IDs from frontend (e.g., "demo-client-001")

## Main Operations

```typescript
// Backend automatically handles:
await imageHandler.addClient(clientId); // On connect
await imageHandler.processWebcamFrame(frame); // Store latest frame
await imageHandler.updateClientLastSeen(clientId); // On any message
await imageHandler.removeClient(clientId); // On disconnect
```

## Monitoring

```typescript
// Stats available
const stats = imageHandler.getStats();
const clientStats = await imageHandler.getClientStats();
```

## Debug Redis

```bash
# Connect to Redis CLI
docker exec -it redis redis-cli

# Check clients
SMEMBERS clients
HGETALL client:demo-client-001
```

That's it! Redis runs locally, auto-cleans inactive clients, and stores the latest frame from each WebRTC client.
