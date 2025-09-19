# Redis Data Storage Documentation

This document describes how SkySentry uses Redis to store and manage client connections, webcam frames, and metadata.

## Overview

SkySentry uses Redis as an in-memory data store to:

- Track active WebRTC clients and their connection status
- Store the latest webcam frame from each client
- Manage client metadata (connection time, last seen, etc.)
- Automatically clean up inactive clients

## Redis Data Structure

### 1. Client Tracking Set

**Key:** `clients`  
**Type:** Redis Set  
**Purpose:** Maintains a list of all currently connected client IDs

```redis
SMEMBERS clients
# Returns: ["Client-abc123xyz", "Client-def456uvw", ...]
```

### 2. Client Metadata Hash

**Key Pattern:** `client:{clientId}`  
**Type:** Redis Hash  
**Purpose:** Stores metadata for each client

```redis
HGETALL client:Client-abc123xyz
# Returns:
# {
#   "connected_at": "2025-09-20T10:30:45.123Z",
#   "last_seen": "2025-09-20T10:32:15.456Z",
#   "status": "connected"
# }
```

### 3. Image Data Hash

**Key Pattern:** `image:{clientId}`  
**Type:** Redis Hash  
**Purpose:** Stores the most recent webcam frame from each client

```redis
HGETALL image:Client-abc123xyz
# Returns:
# {
#   "data": "base64EncodedImageData...",
#   "size": "45678",
#   "format": "jpeg",
#   "timestamp": "2025-09-20T10:32:15.456Z",
#   "frame_number": "1234"
# }
```

## Key Operations

### Client Connection Management

#### Adding a Client

```typescript
await imageHandler.addClient(clientId);
```

- Adds client ID to `clients` set using `SADD`
- Creates client metadata hash with connection timestamp
- Logs total client count

#### Removing a Client

```typescript
await imageHandler.removeClient(clientId);
```

- Removes client ID from `clients` set using `SREM`
- Deletes client metadata hash using `DEL client:{clientId}`
- Deletes client image data using `DEL image:{clientId}`
- Logs remaining client count

#### Updating Client Activity

```typescript
await imageHandler.updateClientLastSeen(clientId);
```

- Updates `last_seen` timestamp in client metadata
- Called on every client message to track activity

### Image Storage

#### Storing Webcam Frames

```typescript
await imageHandler.processWebcamFrame(frame);
```

- Processes image data (base64 or byte array format)
- Stores latest frame in `image:{clientId}` hash
- Updates client `last_seen` timestamp
- Only keeps the most recent frame per client (overwrites previous)

#### Retrieving Client Images

```typescript
const imageData = await imageHandler.getClientImage(clientId);
```

- Returns the latest image data for a specific client
- Includes metadata like size, format, and timestamp

### Client Information Retrieval

#### Get All Connected Clients

```typescript
const clients = await imageHandler.getAllClients();
```

- Returns array of all client IDs from `clients` set

#### Get Client Statistics

```typescript
const stats = await imageHandler.getClientStats();
```

- Returns comprehensive client information including:
  - Total client count
  - List of all client IDs
  - Detailed metadata for each client

#### Get Client Metadata

```typescript
const metadata = await imageHandler.getClientMetadata(clientId);
```

- Returns connection time, last seen, and status for a specific client

## Automatic Cleanup

### Inactive Client Detection

- **Cleanup Interval:** Every 2 seconds
- **Timeout Threshold:** 3 seconds of inactivity
- **Trigger:** No messages received from client within timeout period

### Cleanup Process

1. Retrieves all client IDs from `clients` set
2. Checks `last_seen` timestamp for each client
3. Removes clients inactive for >3 seconds
4. Cleans up associated data (metadata and images)
5. Logs cleanup summary when clients are removed

```typescript
// Automatic cleanup configuration
private readonly INACTIVE_TIMEOUT_MS = 3000; // 3 seconds
```

## Redis Commands Used

| Operation              | Redis Command                  | Purpose                    |
| ---------------------- | ------------------------------ | -------------------------- |
| Add client to set      | `SADD clients {clientId}`      | Track active clients       |
| Remove client from set | `SREM clients {clientId}`      | Remove disconnected client |
| Get all clients        | `SMEMBERS clients`             | List active clients        |
| Count clients          | `SCARD clients`                | Get total client count     |
| Set client metadata    | `HSET client:{id} field value` | Store/update client info   |
| Get client metadata    | `HGETALL client:{id}`          | Retrieve client info       |
| Set image data         | `HSET image:{id} field value`  | Store latest frame         |
| Get image data         | `HGETALL image:{id}`           | Retrieve latest frame      |
| Delete client data     | `DEL client:{id}`              | Clean up on disconnect     |
| Delete image data      | `DEL image:{id}`               | Clean up on disconnect     |

## Configuration

### Redis Connection

- **URL:** `redis://localhost:6379`
- **Client Library:** `redis` npm package
- **Connection Handling:** Automatic reconnection with error handling

### Docker Setup

Use the provided `compose.yml` to start Redis:

```bash
docker compose up -d redis
```

### Redis Insight (Optional)

For GUI management, Redis Insight is available at `http://localhost:5540`:

```bash
docker compose up -d redis-insight
```

## Data Flow Example

1. **Client Connects:**

   ```
   WebSocket connection → addClient() → SADD clients + HSET client:{id}
   ```

2. **Client Sends Frame:**

   ```
   Webcam frame → processWebcamFrame() → HSET image:{id} + HSET client:{id} last_seen
   ```

3. **Client Activity:**

   ```
   Any message → updateClientLastSeen() → HSET client:{id} last_seen
   ```

4. **Client Disconnects:**

   ```
   WebSocket close → removeClient() → SREM clients + DEL client:{id} + DEL image:{id}
   ```

5. **Automatic Cleanup:**
   ```
   Every 2s → Check last_seen → Remove inactive clients
   ```

## Monitoring

### Server Logs

- Client connections/disconnections with total counts
- Cleanup operations when clients are removed
- Redis connection status and errors

### Statistics Available

```typescript
// Basic stats
const stats = imageHandler.getStats();
// { totalFrames, redisConnected, redisUrl }

// Detailed client stats
const clientStats = await imageHandler.getClientStats();
// { totalClients, clientList, clientsWithMetadata }
```

## Troubleshooting

### Common Issues

1. **Redis Not Running:**

   ```bash
   # Start Redis with Docker
   docker compose up -d redis
   ```

2. **Connection Errors:**

   - Check Redis is accessible at `localhost:6379`
   - Verify no firewall blocking connections
   - Check Docker container status

3. **Memory Usage:**
   - Each client uses minimal memory (metadata + one image)
   - Images are stored as base64 strings
   - Automatic cleanup prevents memory leaks

### Debug Commands

```bash
# Connect to Redis CLI
docker exec -it redis redis-cli

# Check client count
SCARD clients

# List all clients
SMEMBERS clients

# Check specific client
HGETALL client:Client-abc123xyz

# Monitor Redis operations
MONITOR
```

## Performance Considerations

- **Memory Usage:** ~50KB per client (metadata + compressed JPEG)
- **Cleanup Overhead:** Minimal, runs every 2 seconds
- **Network:** Local Redis connection, very low latency
- **Scalability:** Can handle hundreds of concurrent clients

## Security Notes

- Redis runs in Docker container with no external access
- No authentication required for local development
- Production deployments should use Redis AUTH
- Consider encryption for sensitive image data
