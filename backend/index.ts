import { WebSocketServer } from "ws";

// Message handler function to process incoming messages
function msgHandler(message: string, clientId?: string) {
  console.log(
    `[MSG HANDLER] ${clientId ? `From ${clientId}: ` : ""}${message}`
  );
}

const wss = new WebSocketServer({ port: 8080 });

console.log("WebRTC Signaling Server running on port 8080");

wss.on("connection", (ws) => {
  const clientId = `Client-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`${clientId} connected`);

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      // Handle WebRTC data channel messages
      if (data.type === "data-channel-message") {
        msgHandler(data.payload, clientId);
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
    }
  });

  ws.on("close", () => {
    console.log(`${clientId} disconnected`);
  });
});
