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

// Your custom message handler function - customize this as needed
const myCustomMessageHandler: CustomMessageHandler = async (
  message: Message
) => {
  // Update client last seen timestamp for any message
  await imageHandler.updateClientLastSeen(message.clientId);

  switch (message.type) {
    case "text_message":
      // Silent - no logging for text messages
      break;

    case "webcam_frame":
      // Silent - no logging for webcam frames
      await imageHandler.processWebcamFrame(message);
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

// Create Elisia app with API routes
const app = new Elysia()
  .use(api)
  .use(cors({ origin: "*" }))
  .listen(parseInt(process.env.API_PORT || "3001"));

console.log(
  `SkySentry API server running on http://localhost:${
    process.env.API_PORT || "3001"
  }`
);

// WebSocket server on port 8080
const wss = new WebSocketServer({
  port: parseInt(process.env.WEBSOCKET_PORT || "8080"),
});

console.log(
  `SkySentry WebSocket server running on port ${
    process.env.WEBSOCKET_PORT || "8080"
  }`
);

// Track WebSocket connections by clientId
const clientConnections = new Map<string, any>();
// Track which clients are looking for peers
const availableClients = new Set<string>();
// Track active peer connections
const peerConnections = new Map<string, string>(); // clientId -> peerId

// Stats every 60 seconds
setInterval(async () => {
  const stats = imageHandler.getStats();
  const clientStats = await imageHandler.getClientStats();
  console.log(
    `Stats: ${stats.totalFrames} frames, ${
      clientStats.totalClients
    } clients, Redis: ${stats.redisConnected ? "OK" : "ERR"}, Active peers: ${
      peerConnections.size / 2
    }`
  );
}, 60000);

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

      // Handle WebRTC data channel messages through blackbox
      if (data.type === "data-channel-message") {
        const actualPayload = data.payload;
        let messageType: string;
        let formattedPayload: any;

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

        await messageHandler.handleMessage(
          JSON.stringify(actualMessage),
          clientId
        );
        return;
      }

      // Handle WebRTC signaling messages with proper peer matching
      if (["offer", "answer", "ice-candidate"].includes(data.type)) {
        console.log(
          `[SIGNALING] ${clientId} sent ${data.type}, available peers: ${
            availableClients.size
          }, peer connections: ${peerConnections.size / 2}`
        );

        if (data.type === "offer") {
          // Remove this client from available pool since they're creating an offer
          availableClients.delete(clientId);

          // Find an available peer to send the offer to
          const availablePeers = Array.from(availableClients);
          console.log(
            `[PAIRING] Available peers for ${clientId}:`,
            availablePeers
          );

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
            console.log(
              `[WAITING] ${clientId} waiting for peer (${availableClients.size} clients available)`
            );

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
              console.log(
                `[RELAY] ${data.type} from ${clientId} to ${targetPeer}`
              );
            } else {
              console.error(
                `[ERROR] Cannot relay ${data.type} - target peer ${targetPeer} not available`
              );
            }
          } else {
            console.warn(
              `[WARNING] ${clientId} sent ${data.type} but has no paired peer`
            );
          }
        }
        return;
      }

      // Handle other messages through blackbox
      await messageHandler.handleMessage(messageString, clientId);
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
      await messageHandler.handleMessage(messageBuffer, clientId);
    }
  });

  ws.on("close", () => {
    if (clientId) {
      console.log(`${clientId} disconnected`);
      clientConnections.delete(clientId);
      availableClients.delete(clientId);

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
