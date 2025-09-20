import { WebSocketServer } from "ws";
import { Elysia } from "elysia";
import {
  BlackboxMessageHandler,
  type CustomMessageHandler,
} from "./blackboxHandler.js";
import { type Message } from "./messageTypes.js";
import { ImageHandler } from "./imageHandler.js";
import { api } from "./api.js";

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

// Stats every 60 seconds
setInterval(async () => {
  const stats = imageHandler.getStats();
  const clientStats = await imageHandler.getClientStats();
  console.log(
    `Stats: ${stats.totalFrames} frames, ${
      clientStats.totalClients
    } clients, Redis: ${stats.redisConnected ? "OK" : "ERR"}`
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
            console.log(`${clientId} connected`);
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
          console.log(`${clientId} connected`);
          // Add client to Redis
          await imageHandler.addClient(clientId);
        }
      }

      // If we still don't have a clientId, generate a fallback
      if (!clientId) {
        clientId = `Client-${Math.random().toString(36).substr(2, 9)}`;
        clientConnections.set(clientId, ws);
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

      // Handle WebRTC signaling messages (pass through)
      if (["offer", "answer", "ice-candidate"].includes(data.type)) {
        // Broadcast signaling messages to all other clients
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === 1) {
            client.send(JSON.stringify(data));
          }
        });
        return;
      }

      // Handle other messages through blackbox
      await messageHandler.handleMessage(messageString, clientId);
    } catch (error) {
      // Handle as raw binary data
      if (!clientId) {
        clientId = `Client-${Math.random().toString(36).substr(2, 9)}`;
        clientConnections.set(clientId, ws);
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
      imageHandler.removeClient(clientId);
    }
  });

  ws.on("error", (error) => {
    if (clientId) {
      console.error(`${clientId} WebSocket error:`, error.message);
      clientConnections.delete(clientId);
      imageHandler.removeClient(clientId);
    }
  });
});
