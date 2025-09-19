import { WebSocketServer } from "ws";
import { MessageHandler } from "./messageHandler.js";

const messageHandler = new MessageHandler();

const wss = new WebSocketServer({ port: 8080 });

console.log("WebRTC Signaling Server running on port 8080");

// Log stats every 30 seconds
setInterval(() => {
  const stats = messageHandler.getStats();
  console.log(
    `[STATS] Total messages: ${stats.totalMessages}, Webcam frames: ${stats.webcamFrames}`
  );
}, 30000);

wss.on("connection", (ws) => {
  const clientId = `Client-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`${clientId} connected`);

  ws.on("message", (message) => {
    try {
      const messageString = message.toString();
      const data = JSON.parse(messageString);

      // Handle WebRTC data channel messages
      if (data.type === "data-channel-message") {
        messageHandler.handleMessage(messageString, clientId);
        return;
      }

      console.log("Received signaling:", data.type);

      // Broadcast signaling messages to all other clients
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(JSON.stringify(data));
        }
      });
    } catch (error) {
      console.error("Error parsing message:", error);
      // Handle as raw binary data
      const messageBuffer = Buffer.isBuffer(message)
        ? message
        : Buffer.from(message as ArrayBuffer);
      messageHandler.handleMessage(messageBuffer, clientId);
    }
  });

  ws.on("close", () => {
    console.log(`${clientId} disconnected`);
  });
});
