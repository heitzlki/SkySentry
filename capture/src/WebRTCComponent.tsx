import { useState, useEffect, useRef } from "react";

interface WebRTCComponentProps {}

const WebRTCComponent: React.FC<WebRTCComponentProps> = () => {
  const [connectionStatus, setConnectionStatus] =
    useState<string>("Disconnected");
  const [messages, setMessages] = useState<string[]>([]);
  const [webcamStatus, setWebcamStatus] = useState<string>("Not started");
  const [isStreamingWebcam, setIsStreamingWebcam] = useState<boolean>(false);
  const [dataChannelReady, setDataChannelReady] = useState<boolean>(false);
  const [pendingMessages, setPendingMessages] = useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const intervalRef = useRef<number | null>(null);
  const webcamIntervalRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const messageQueueRef = useRef<
    Array<{ message: string | ArrayBuffer; type: "text" | "binary" }>
  >([]);

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
      wsRef.current = new WebSocket(
        import.meta.env.VITE_WEBSOCKET_URL || "ws://localhost:8080"
      );

      wsRef.current.onopen = () => {
        createPeerConnection();
        // Start sending messages immediately via WebSocket
        startSendingMessages();
      };

      wsRef.current.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        await handleSignalingMessage(data);
      };

      wsRef.current.onclose = () => {
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
      setConnectionStatus("Connected");
      setDataChannelReady(true);
      // Send any queued messages
      const queueLength = messageQueueRef.current.length;
      while (messageQueueRef.current.length > 0) {
        const { message, type } = messageQueueRef.current.shift()!;
        sendMessage(message, type);
      }
      if (queueLength > 0) {
        setPendingMessages(0);
        setMessages((prev) => [
          ...prev,
          `✅ Sent ${queueLength} queued messages`,
        ]);
      }
    };

    dataChannelRef.current.onmessage = (event) => {
      setMessages((prev) => [...prev, `Received: ${event.data}`]);
    };

    dataChannelRef.current.onclose = () => {
      setDataChannelReady(false);
    };

    // Handle incoming data channel
    peerConnectionRef.current.ondatachannel = (event) => {
      const channel = event.channel;
      channel.onmessage = (event) => {
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

  // Blackbox sendMessage function interface
  const sendMessage = (
    message: string | ArrayBuffer,
    type: "text" | "binary" = "text"
  ) => {
    try {
      if (
        dataChannelRef.current &&
        dataChannelRef.current.readyState === "open"
      ) {
        // Send via WebRTC data channel (peer-to-peer)
        if (typeof message === "string") {
          dataChannelRef.current.send(message);
        } else {
          dataChannelRef.current.send(message);
        }

        // Also send to server for logging via WebSocket (always do this)
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const payload =
            type === "binary"
              ? `[Binary data: ${
                  message instanceof ArrayBuffer ? message.byteLength : 0
                } bytes]`
              : message;

          wsRef.current.send(
            JSON.stringify({
              type: "data-channel-message",
              payload: payload,
            })
          );
        }

        const logMessage =
          type === "binary"
            ? `Sent binary data: ${
                message instanceof ArrayBuffer ? message.byteLength : 0
              } bytes`
            : `Sent: ${message}`;

        setMessages((prev) => [...prev, logMessage]);
        return true;
      } else {
        // Data channel not ready, fallback to WebSocket only
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const payload =
            type === "binary"
              ? `[Binary data: ${
                  message instanceof ArrayBuffer ? message.byteLength : 0
                } bytes]`
              : message;

          wsRef.current.send(
            JSON.stringify({
              type: "data-channel-message",
              payload: payload,
            })
          );

          const logMessage =
            type === "binary"
              ? `Sent binary data via WebSocket: ${
                  message instanceof ArrayBuffer ? message.byteLength : 0
                } bytes`
              : `Sent via WebSocket: ${message}`;

          setMessages((prev) => [...prev, logMessage]);
          return true;
        } else {
          console.warn("Neither data channel nor WebSocket ready for sending");
          // Queue the message if neither is ready
          messageQueueRef.current.push({ message, type });
          setPendingMessages((prev) => prev + 1);
          return false;
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      return false;
    }
  };

  // Initialize webcam
  const initializeWebcam = async () => {
    try {
      setWebcamStatus("Requesting camera access...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, frameRate: 30 },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setWebcamStatus("Camera ready");
      return true;
    } catch (error) {
      console.error("Error accessing webcam:", error);
      setWebcamStatus(
        `Camera error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return false;
    }
  };

  // Capture frame from webcam and send it
  const captureAndSendFrame = () => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob and send
    canvas.toBlob(
      (blob) => {
        if (blob) {
          blob.arrayBuffer().then((buffer) => {
            sendMessage(buffer, "binary");
          });
        }
      },
      "image/jpeg",
      0.8
    );
  };

  // Start streaming webcam frames
  const startWebcamStreaming = async () => {
    if (!streamRef.current) {
      const success = await initializeWebcam();
      if (!success) return;
    }

    setIsStreamingWebcam(true);
    setWebcamStatus("Streaming...");

    // Send frames every 100ms (10 FPS)
    webcamIntervalRef.current = window.setInterval(() => {
      captureAndSendFrame();
    }, 100);
  };

  // Stop streaming webcam frames
  const stopWebcamStreaming = () => {
    setIsStreamingWebcam(false);
    setWebcamStatus("Camera ready");

    if (webcamIntervalRef.current) {
      clearInterval(webcamIntervalRef.current);
      webcamIntervalRef.current = null;
    }
  };

  // Stop webcam completely
  const stopWebcam = () => {
    stopWebcamStreaming();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setWebcamStatus("Not started");
  };

  const startSendingMessages = () => {
    intervalRef.current = window.setInterval(() => {
      const timestamp = new Date().toISOString();
      const message = `Hi from browser ${timestamp}`;
      sendMessage(message);
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
    stopWebcam();
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
        Connection Status: <strong>{connectionStatus}</strong>
      </p>
      <p>
        Data Channel:{" "}
        <strong style={{ color: dataChannelReady ? "green" : "orange" }}>
          {dataChannelReady ? "Ready" : "Not Ready"}
        </strong>
      </p>
      <p>
        Webcam Status: <strong>{webcamStatus}</strong>
      </p>
      {pendingMessages > 0 && (
        <p style={{ color: "orange" }}>
          Pending Messages: <strong>{pendingMessages}</strong> (will send via
          WebSocket)
        </p>
      )}

      <div style={{ marginBottom: "20px" }}>
        <h3>Connection Info:</h3>
        <p style={{ fontSize: "0.9em", color: "#666" }}>
          💡 WebRTC data channel requires two peers. If you're testing alone,
          messages will be sent via WebSocket fallback to the server for
          logging. Open multiple browser tabs to test true peer-to-peer
          communication.
        </p>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h3>Webcam Controls:</h3>
        <button
          onClick={initializeWebcam}
          disabled={!!streamRef.current}
          style={{ marginRight: "10px" }}
        >
          Initialize Camera
        </button>
        <button
          onClick={startWebcamStreaming}
          disabled={!streamRef.current || isStreamingWebcam}
          style={{ marginRight: "10px" }}
        >
          Start Streaming
        </button>
        <button
          onClick={stopWebcamStreaming}
          disabled={!isStreamingWebcam}
          style={{ marginRight: "10px" }}
        >
          Stop Streaming
        </button>
        <button onClick={stopWebcam} disabled={!streamRef.current}>
          Stop Camera
        </button>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <video
          ref={videoRef}
          style={{
            width: "320px",
            height: "240px",
            border: "1px solid #ccc",
            backgroundColor: "#000",
          }}
          muted
          playsInline
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>

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
