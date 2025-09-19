import { WebSocketServer } from "ws";
import {
  BlackboxMessageHandler,
  type CustomMessageHandler,
} from "./blackboxHandler.js";
import { type Message } from "./messageTypes.js";
import { ImageHandler } from "./imageHandler.js";

// Initialize the image handler
const imageHandler = new ImageHandler();

// Your custom message handler function - customize this as needed
const myCustomMessageHandler: CustomMessageHandler = async (
  message: Message
) => {
  switch (message.type) {
    case "text_message":
      console.log(`[TEXT] ${message.clientId}: ${message.payload}`);
      break;

    case "webcam_frame":
      console.log(
        `[WEBCAM] ${message.clientId}: Frame ${message.payload.size} bytes (${message.payload.format})`
      );

      // Pass to imageHandler for processing
      await imageHandler.processWebcamFrame(message);
      break;

    case "connection_status":
      console.log(
        `[STATUS] ${message.clientId}: ${message.payload.status} - ${
          message.payload.details || "No details"
        }`
      );
      break;

    case "heartbeat":
      console.log(
        `[HEARTBEAT] ${message.clientId}: ${message.payload.timestamp}`
      );
      break;

    case "error":
      console.error(
        `[ERROR] ${message.clientId}: ${message.payload.message} (${
          message.payload.code || "NO_CODE"
        })`
      );
      break;

    default:
      // Exhaustive check - this should never happen with proper typing
      const exhaustiveCheck: never = message;
      console.error(`[UNKNOWN] Unhandled message type:`, exhaustiveCheck);
  }
};

// Initialize the blackbox handler with your custom handler
const messageHandler = new BlackboxMessageHandler(myCustomMessageHandler);

const wss = new WebSocketServer({ port: 8080 });

console.log("WebRTC Signaling Server running on port 8080");

// Log stats every 30 seconds
setInterval(() => {
  const stats = messageHandler.getStats();
  const imageStats = imageHandler.getStats();
  console.log(
    `[STATS] Total: ${stats.totalMessages}, By type:`,
    stats.messagesByType
  );
  console.log(
    `[IMAGE STATS] Frames processed: ${imageStats.totalFrames}, Assets dir: ${imageStats.assetsDir}`
  );
}, 30000);

wss.on("connection", (ws) => {
  const clientId = `Client-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`${clientId} connected`);

  // Send connection status
  messageHandler.handleMessage(
    JSON.stringify({
      type: "connection_status",
      payload: {
        status: "connected",
        details: "WebSocket connection established",
      },
    }),
    clientId
  );

  ws.on("message", async (message) => {
    try {
      const messageString = message.toString();
      const data = JSON.parse(messageString);

      // Handle WebRTC data channel messages through blackbox
      if (data.type === "data-channel-message") {
        // The payload is the actual message, extract it properly
        const actualPayload = data.payload;

        // Determine the correct message type based on the payload structure
        let messageType: string;
        let formattedPayload: any;

        if (typeof actualPayload === "string") {
          if (actualPayload.startsWith("[Binary data:")) {
            messageType = "webcam_frame";
            // Parse the binary data string to extract size
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
          // Check if it's already a properly structured message
          if (actualPayload.type) {
            messageType = actualPayload.type;
            formattedPayload = actualPayload.payload;
          } else {
            // Determine type based on payload structure
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
        console.log("Received signaling:", data.type);

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
      console.error("Error parsing message:", error);
      // Handle as raw binary data
      const messageBuffer = Buffer.isBuffer(message)
        ? message
        : Buffer.from(message as ArrayBuffer);
      await messageHandler.handleMessage(messageBuffer, clientId);
    }
  });

  ws.on("close", () => {
    console.log(`${clientId} disconnected`);
    messageHandler.handleMessage(
      JSON.stringify({
        type: "connection_status",
        payload: {
          status: "disconnected",
          details: "WebSocket connection closed",
        },
      }),
      clientId
    );
  });
});
