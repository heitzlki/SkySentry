import { useState, useEffect, useRef } from "react";

interface WebRTCComponentProps {}

const WebRTCComponent: React.FC<WebRTCComponentProps> = () => {
  const [connectionStatus, setConnectionStatus] =
    useState<string>("Disconnected");
  const [messages, setMessages] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const intervalRef = useRef<number | null>(null);

  const configuration: RTCConfiguration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  useEffect(() => {
    initializeConnection();
    return () => cleanup();
  }, []);

  const initializeConnection = async () => {
    try {
      // Initialize WebSocket for signaling
      wsRef.current = new WebSocket("ws://localhost:8080");

      wsRef.current.onopen = () => {
        console.log("WebSocket connected");
        createPeerConnection();
        // Start sending messages immediately via WebSocket
        startSendingMessages();
      };

      wsRef.current.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        await handleSignalingMessage(data);
      };

      wsRef.current.onclose = () => {
        console.log("WebSocket disconnected");
        setConnectionStatus("Disconnected");
        stopSendingMessages();
      };
    } catch (error) {
      console.error("Connection error:", error);
      setConnectionStatus("Error");
    }
  };

  const createPeerConnection = () => {
    peerConnectionRef.current = new RTCPeerConnection(configuration);

    // Create data channel
    dataChannelRef.current = peerConnectionRef.current.createDataChannel(
      "messages",
      {
        ordered: true,
      }
    );

    dataChannelRef.current.onopen = () => {
      console.log("Data channel opened");
      setConnectionStatus("Connected");
    };

    dataChannelRef.current.onmessage = (event) => {
      console.log("Received message:", event.data);
      setMessages((prev) => [...prev, `Received: ${event.data}`]);
    };

    dataChannelRef.current.onclose = () => {
      console.log("Data channel closed");
    };

    // Handle incoming data channel
    peerConnectionRef.current.ondatachannel = (event) => {
      const channel = event.channel;
      channel.onmessage = (event) => {
        console.log("Received message:", event.data);
        setMessages((prev) => [...prev, `Received: ${event.data}`]);
      };
    };

    // Handle ICE candidates
    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: "ice-candidate",
            payload: event.candidate,
          })
        );
      }
    };

    // Create offer
    createOffer();
  };

  const createOffer = async () => {
    if (!peerConnectionRef.current) return;

    try {
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);

      if (wsRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: "offer",
            payload: offer,
          })
        );
      }
    } catch (error) {
      console.error("Error creating offer:", error);
    }
  };

  const handleSignalingMessage = async (data: any) => {
    if (!peerConnectionRef.current) return;

    try {
      switch (data.type) {
        case "offer":
          await peerConnectionRef.current.setRemoteDescription(data.payload);
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);

          if (wsRef.current) {
            wsRef.current.send(
              JSON.stringify({
                type: "answer",
                payload: answer,
              })
            );
          }
          break;

        case "answer":
          await peerConnectionRef.current.setRemoteDescription(data.payload);
          break;

        case "ice-candidate":
          await peerConnectionRef.current.addIceCandidate(data.payload);
          break;
      }
    } catch (error) {
      console.error("Error handling signaling message:", error);
    }
  };

  const startSendingMessages = () => {
    intervalRef.current = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const timestamp = new Date().toISOString();
        const message = `Hi from browser ${timestamp}`;

        // Send message to server via WebSocket for logging
        wsRef.current.send(
          JSON.stringify({
            type: "data-channel-message",
            payload: message,
          })
        );

        setMessages((prev) => [...prev, `Sent: ${message}`]);
      }
    }, 1000);
  };

  const stopSendingMessages = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const cleanup = () => {
    stopSendingMessages();
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  return (
    <div>
      <h1>WebRTC Data Channel Test</h1>
      <p>
        Status: <strong>{connectionStatus}</strong>
      </p>

      <div>
        <h3>Messages (last 10):</h3>
        <div
          style={{
            height: "200px",
            overflow: "auto",
            border: "1px solid #ccc",
            padding: "10px",
          }}
        >
          {messages.slice(-10).map((msg, index) => (
            <div key={index}>{msg}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WebRTCComponent;
