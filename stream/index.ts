import { WebSocketServer } from "ws";
import { Elysia } from "elysia";
import {
  BlackboxMessageHandler,
  type CustomMessageHandler,
} from "./blackboxHandler.js";
import { type Message } from "./messageTypes.js";
import { ImageHandler } from "./imageHandler.js";
import { api } from "./api.js";
import cors from "@elysiajs/cors";

// Initialize the image handler
const imageHandler = new ImageHandler();

// In-memory frame cache for ultra-low latency
const frameCache = new Map<
  string,
  {
    data: Buffer;
    timestamp: number;
    frameNumber: number;
    size: number;
  }
>();

// WebSocket connections for real-time broadcasting
const streamSubscribers = new Set<any>();

// Your custom message handler function - optimized for performance
const myCustomMessageHandler: CustomMessageHandler = async (
  message: Message
) => {
  // Update client last seen timestamp for any message (non-blocking)
  imageHandler.updateClientLastSeen(message.clientId).catch(() => {});

  switch (message.type) {
    case "text_message":
      // Silent - no logging for text messages
      break;

    case "webcam_frame":
      // Cache frame in memory for instant access
      if (
        message.payload.data &&
        message.payload.data !== "binary_data_placeholder"
      ) {
        try {
          let frameBuffer: Buffer;

          // Optimize data parsing
          if (typeof message.payload.data === "string") {
            if (message.payload.data.includes(",")) {
              // Fast array parsing
              const byteArray = new Uint8Array(
                message.payload.data.split(",").map((str) => parseInt(str, 10))
              );
              frameBuffer = Buffer.from(byteArray);
            } else {
              frameBuffer = Buffer.from(message.payload.data, "base64");
            }
          } else {
            frameBuffer = Buffer.from(message.payload.data);
          }

          // Cache frame for instant access
          const frameData = {
            data: frameBuffer,
            timestamp: Date.now(),
            frameNumber:
              (frameCache.get(message.clientId)?.frameNumber ?? 0) + 1,
            size: frameBuffer.length,
          };

          frameCache.set(message.clientId, frameData);

          // Broadcast to streaming subscribers immediately
          const streamData = JSON.stringify({
            type: "frame_update",
            clientId: message.clientId,
            frame: frameBuffer.toString("base64"),
            timestamp: frameData.timestamp,
            frameNumber: frameData.frameNumber,
            size: frameData.size,
          });

          // Broadcast to all streaming subscribers (non-blocking)
          streamSubscribers.forEach((ws) => {
            if (ws.readyState === 1) {
              ws.send(streamData);
            }
          });

          // Store in Redis asynchronously (non-blocking)
          imageHandler.processWebcamFrame(message).catch(() => {});
        } catch (error) {
          // Silent fail - don't block processing
        }
      }
      break;

    case "connection_status":
      if (
        message.payload.status === "connected" ||
        message.payload.status === "disconnected"
      ) {
        console.log(`${message.clientId}: ${message.payload.status}`);
      }
      break;

    case "heartbeat":
      // Silent - no logging for heartbeats
      break;

    case "error":
      console.error(`${message.clientId} error: ${message.payload.message}`);
      break;

    default:
      const exhaustiveCheck: never = message;
      console.error(`Unknown message type:`, exhaustiveCheck);
  }
};

// Initialize the blackbox handler with your custom handler
const messageHandler = new BlackboxMessageHandler(myCustomMessageHandler);

// Create optimized API with streaming endpoints
const optimizedApi = new Elysia({ prefix: "/api" })
  .use(cors())
  // Fast streaming endpoint
  .get("/stream/ws", ({ request }) => {
    const upgradeHeader = request.headers.get("upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected websocket", { status: 400 });
    }

    // This will be handled by WebSocket server
    return new Response(null, { status: 101 });
  })
  // Fast frame access from memory cache
  .get("/cameras/live", async () => {
    const cameras = Array.from(frameCache.entries()).map(
      ([clientId, frame]) => ({
        id: clientId,
        image: `data:image/jpeg;base64,${frame.data.toString("base64")}`,
        timestamp: new Date(frame.timestamp).toISOString(),
        frameNumber: frame.frameNumber,
        size: frame.size,
        status: "online",
      })
    );

    return {
      success: true,
      cameras,
      count: cameras.length,
      cached: true,
    };
  })
  // Keep existing API for compatibility
  .use(api);

// Create Elysia app with optimized API routes
const app = new Elysia()
  .use(optimizedApi)
  .use(cors({ origin: "*" }))
  .listen(parseInt(process.env.API_PORT || "3001"));

console.log(
  `SkySentry API server running on http://localhost:${
    process.env.API_PORT || "3001"
  }`
);

// Optimized WebSocket server
const wss = new WebSocketServer({
  port: parseInt(process.env.WEBSOCKET_PORT || "8080"),
});

// Streaming WebSocket server for real-time frame broadcasting
const streamingWss = new WebSocketServer({
  port: parseInt(process.env.STREAMING_PORT || "8081"),
});

console.log(
  `SkySentry WebSocket server running on port ${
    process.env.WEBSOCKET_PORT || "8080"
  }`
);

console.log(
  `SkySentry Streaming server running on port ${
    process.env.STREAMING_PORT || "8081"
  }`
);

// Handle streaming WebSocket connections
streamingWss.on("connection", (ws) => {
  console.log("Streaming client connected");
  streamSubscribers.add(ws);

  // Send current frames immediately
  for (const [clientId, frame] of frameCache.entries()) {
    const streamData = JSON.stringify({
      type: "frame_update",
      clientId,
      frame: frame.data.toString("base64"),
      timestamp: frame.timestamp,
      frameNumber: frame.frameNumber,
      size: frame.size,
    });

    if (ws.readyState === 1) {
      ws.send(streamData);
    }
  }

  ws.on("close", () => {
    streamSubscribers.delete(ws);
    console.log("Streaming client disconnected");
  });

  ws.on("error", () => {
    streamSubscribers.delete(ws);
  });
});

// Track WebSocket connections by clientId
const clientConnections = new Map<string, any>();
// Track which clients are looking for peers
const availableClients = new Set<string>();
// Track active peer connections
const peerConnections = new Map<string, string>(); // clientId -> peerId

// Optimized stats logging (reduced frequency)
setInterval(async () => {
  const stats = imageHandler.getStats();
  const clientStats = await imageHandler.getClientStats();
  console.log(
    `Stats: ${stats.totalFrames} frames, ${
      clientStats.totalClients
    } clients, Cache: ${frameCache.size}, Redis: ${
      stats.redisConnected ? "OK" : "ERR"
    }, Active peers: ${peerConnections.size / 2}`
  );
}, 30000); // Reduced from 60s to 30s

// Clean up frame cache periodically
setInterval(() => {
  const now = Date.now();
  const maxAge = 10000; // 10 seconds

  for (const [clientId, frame] of frameCache.entries()) {
    if (now - frame.timestamp > maxAge) {
      frameCache.delete(clientId);
    }
  }
}, 5000);

wss.on("connection", (ws) => {
  let clientId: string | null = null;

  ws.on("message", async (message) => {
    try {
      const messageString = message.toString();
      const data = JSON.parse(messageString);

      // Handle client registration message (sent immediately on WebSocket open)
      if (data.type === "client-registration") {
        if (data.clientId && !clientId) {
          clientId = data.clientId;
          if (clientId) {
            clientConnections.set(clientId, ws);
            availableClients.add(clientId);
            console.log(`${clientId} connected and available for pairing`);
            await imageHandler.addClient(clientId);
          }
        }
        return;
      }

      // Extract or register clientId from other messages
      if (data.clientId && !clientId) {
        clientId = data.clientId;
        if (clientId) {
          clientConnections.set(clientId, ws);
          availableClients.add(clientId);
          console.log(`${clientId} connected`);
          // Add client to Redis
          await imageHandler.addClient(clientId);
        }
      }

      // If we still don't have a clientId, generate a fallback
      if (!clientId) {
        clientId = `Client-${Math.random().toString(36).substr(2, 9)}`;
        clientConnections.set(clientId, ws);
        availableClients.add(clientId);
        console.log(`${clientId} connected (fallback ID)`);
        await imageHandler.addClient(clientId);
      }

      // Handle WebRTC data channel messages through blackbox - OPTIMIZED
      if (data.type === "data-channel-message") {
        const actualPayload = data.payload;
        let messageType: string;
        let formattedPayload: any;

        // Fast message type detection
        if (typeof actualPayload === "string") {
          if (actualPayload.startsWith("[Binary data:")) {
            messageType = "webcam_frame";
            const sizeMatch = actualPayload.match(/(\d+) bytes/);
            const size = sizeMatch ? parseInt(sizeMatch[1]) : 0;
            formattedPayload = {
              data: "binary_data_placeholder",
              size: size,
              format: "binary",
            };
          } else {
            messageType = "text_message";
            formattedPayload = actualPayload;
          }
        } else if (actualPayload && typeof actualPayload === "object") {
          if (actualPayload.type) {
            messageType = actualPayload.type;
            formattedPayload = actualPayload.payload;
          } else {
            if (actualPayload.status) {
              messageType = "connection_status";
              formattedPayload = actualPayload;
            } else if (
              actualPayload.timestamp &&
              Object.keys(actualPayload).length === 1
            ) {
              messageType = "heartbeat";
              formattedPayload = actualPayload;
            } else if (actualPayload.data && actualPayload.size !== undefined) {
              messageType = "webcam_frame";
              formattedPayload = actualPayload;
            } else if (actualPayload.message) {
              messageType = "error";
              formattedPayload = actualPayload;
            } else {
              messageType = "text_message";
              formattedPayload = JSON.stringify(actualPayload);
            }
          }
        } else {
          messageType = "text_message";
          formattedPayload = String(actualPayload);
        }

        const actualMessage = {
          type: messageType,
          payload: formattedPayload,
          clientId,
          timestamp: new Date().toISOString(),
        };

        // Process message asynchronously to avoid blocking
        messageHandler
          .handleMessage(JSON.stringify(actualMessage), clientId)
          .catch(() => {});
        return;
      }

      // Handle WebRTC signaling messages with proper peer matching
      if (["offer", "answer", "ice-candidate"].includes(data.type)) {
        if (data.type === "offer") {
          // Remove this client from available pool since they're creating an offer
          availableClients.delete(clientId);

          // Find an available peer to send the offer to
          const availablePeers = Array.from(availableClients);

          if (availablePeers.length > 0) {
            const targetPeer = availablePeers[0]; // Take the first available peer
            availableClients.delete(targetPeer); // Remove them from available pool

            // Establish peer connection mapping
            peerConnections.set(clientId, targetPeer);
            peerConnections.set(targetPeer, clientId);

            const targetWs = clientConnections.get(targetPeer);
            if (targetWs && targetWs.readyState === 1) {
              targetWs.send(JSON.stringify(data));
              console.log(`[PAIRED] ${clientId} <-> ${targetPeer}`);
            } else {
              console.error(
                `[ERROR] Target peer ${targetPeer} WebSocket not ready`
              );
              // Clean up failed pairing
              peerConnections.delete(clientId);
              peerConnections.delete(targetPeer);
              availableClients.add(clientId);
              availableClients.add(targetPeer);
            }
          } else {
            // No available peers, put this client back in available pool
            availableClients.add(clientId);

            // Send a message back to client indicating they're waiting
            if (ws.readyState === 1) {
              ws.send(
                JSON.stringify({
                  type: "waiting-for-peer",
                  message: "Waiting for another client to connect...",
                })
              );
            }
          }
        } else {
          // For answers and ICE candidates, send to the paired peer
          const targetPeer = peerConnections.get(clientId);
          if (targetPeer) {
            const targetWs = clientConnections.get(targetPeer);
            if (targetWs && targetWs.readyState === 1) {
              targetWs.send(JSON.stringify(data));
            }
          }
        }
        return;
      }

      // Handle other messages through blackbox (non-blocking)
      messageHandler.handleMessage(messageString, clientId).catch(() => {});
    } catch (error) {
      // Handle as raw binary data
      if (!clientId) {
        clientId = `Client-${Math.random().toString(36).substr(2, 9)}`;
        clientConnections.set(clientId, ws);
        availableClients.add(clientId);
        console.log(`${clientId} connected (binary fallback ID)`);
        await imageHandler.addClient(clientId);
      }

      const messageBuffer = Buffer.isBuffer(message)
        ? message
        : Buffer.from(message as ArrayBuffer);
      messageHandler.handleMessage(messageBuffer, clientId).catch(() => {});
    }
  });

  ws.on("close", () => {
    if (clientId) {
      console.log(`${clientId} disconnected`);
      clientConnections.delete(clientId);
      availableClients.delete(clientId);
      frameCache.delete(clientId); // Clean up frame cache

      // Clean up peer connection if exists
      const pairedPeer = peerConnections.get(clientId);
      if (pairedPeer) {
        peerConnections.delete(clientId);
        peerConnections.delete(pairedPeer);
        // Put the paired peer back in available pool
        availableClients.add(pairedPeer);
        console.log(
          `Disconnected ${clientId}, ${pairedPeer} is now available for new pairing`
        );
      }

      imageHandler.removeClient(clientId);
    }
  });

  ws.on("error", (error) => {
    if (clientId) {
      console.error(`${clientId} WebSocket error:`, error.message);
      clientConnections.delete(clientId);
      availableClients.delete(clientId);
      frameCache.delete(clientId); // Clean up frame cache

      // Clean up peer connection if exists
      const pairedPeer = peerConnections.get(clientId);
      if (pairedPeer) {
        peerConnections.delete(clientId);
        peerConnections.delete(pairedPeer);
        availableClients.add(pairedPeer);
      }

      imageHandler.removeClient(clientId);
    }
  });
});
