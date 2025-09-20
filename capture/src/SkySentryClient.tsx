import { useState, useEffect, useRef, useCallback } from "react";

interface SkySentryClientProps {
  clientId: string;
  serverUrl?: string;
  autoStartCamera?: boolean;
  frameRate?: number;
}

const SkySentryClient: React.FC<SkySentryClientProps> = ({
  clientId,
  serverUrl = import.meta.env.VITE_WEBSOCKET_URL || "ws://localhost:8080",
  autoStartCamera = false,
  frameRate = 30, // Increased default frame rate
}) => {
  const [status, setStatus] = useState<
    "disconnected" | "connecting" | "connected" | "error"
  >("disconnected");
  const [cameraStatus, setCameraStatus] = useState<
    "inactive" | "starting" | "active" | "streaming" | "error"
  >("inactive");

  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const streamingIntervalRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const isInitializingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  // Performance optimization - track last frame time
  const lastFrameTimeRef = useRef<number>(0);

  const configuration: RTCConfiguration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  // Optimized message sending function with direct binary support
  const sendMessage = useCallback(
    (type: string, payload: any) => {
      if (!isMountedRef.current) return false;

      const message = {
        type,
        payload,
        clientId,
        timestamp: new Date().toISOString(),
      };

      try {
        // Try WebRTC data channel first
        if (dataChannelRef.current?.readyState === "open") {
          dataChannelRef.current.send(JSON.stringify(message));
          return true;
        }

        // Fallback to WebSocket
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "data-channel-message",
              payload: message,
            })
          );
          return true;
        }

        return false;
      } catch (error) {
        console.error("Error sending message:", error);
        return false;
      }
    },
    [clientId]
  );

  // Optimized binary frame sending
  const sendBinaryFrame = useCallback(
    (buffer: ArrayBuffer) => {
      if (!isMountedRef.current) return false;

      try {
        // Convert to base64 for transmission (optimized)
        const uint8Array = new Uint8Array(buffer);
        let binary = "";
        const len = uint8Array.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binary);

        const frameMessage = {
          type: "webcam_frame",
          payload: {
            data: base64,
            size: buffer.byteLength,
            format: "jpeg",
            timestamp: Date.now(),
          },
          clientId,
          timestamp: new Date().toISOString(),
        };

        // Try WebRTC data channel first
        if (dataChannelRef.current?.readyState === "open") {
          dataChannelRef.current.send(JSON.stringify(frameMessage));
          return true;
        }

        // Fallback to WebSocket
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "data-channel-message",
              payload: frameMessage,
            })
          );
          return true;
        }

        return false;
      } catch (error) {
        console.error("Error sending binary frame:", error);
        return false;
      }
    },
    [clientId]
  );

  // Handle signaling messages
  const handleSignalingMessage = useCallback(
    async (data: any) => {
      if (!peerConnectionRef.current || !isMountedRef.current) return;

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
                  clientId,
                })
              );
            }
            break;

          case "answer":
            await peerConnectionRef.current.setRemoteDescription(data.payload);
            break;

          case "ice-candidate":
            if (peerConnectionRef.current.remoteDescription) {
              await peerConnectionRef.current.addIceCandidate(data.payload);
            } else {
              console.warn(
                "Received ICE candidate before remote description, ignoring"
              );
            }
            break;
        }
      } catch (error) {
        console.error("Error handling signaling message:", error);
      }
    },
    [clientId]
  );

  const createOffer = useCallback(async () => {
    if (!peerConnectionRef.current || !isMountedRef.current) return;

    try {
      const pc = peerConnectionRef.current;

      // Only create offer if we're in stable state
      if (pc.signalingState !== "stable") {
        console.warn(`Cannot create offer in state: ${pc.signalingState}`);
        return;
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (wsRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: "offer",
            payload: offer,
            clientId,
          })
        );
      }
    } catch (error) {
      console.error("Error creating offer:", error);
    }
  }, [clientId]);

  const createPeerConnection = useCallback(() => {
    if (peerConnectionRef.current || !isMountedRef.current) return;

    peerConnectionRef.current = new RTCPeerConnection(configuration);

    // Create data channel with optimized settings
    dataChannelRef.current = peerConnectionRef.current.createDataChannel(
      "messages",
      {
        ordered: false, // Allow out-of-order delivery for better performance
        maxRetransmits: 0, // Don't retransmit for real-time streaming
      }
    );

    dataChannelRef.current.onopen = () => {
      if (!isMountedRef.current) return;
      setStatus("connected");
    };

    dataChannelRef.current.onclose = () => {
      // Silent
    };

    // Handle incoming data channel - removed unused event parameter
    peerConnectionRef.current.ondatachannel = (event) => {
      const channel = event.channel;
      channel.onmessage = () => {
        // Silent - optimized for performance
      };
    };

    // Handle connection state changes
    peerConnectionRef.current.onconnectionstatechange = () => {
      if (!peerConnectionRef.current) return;
      const state = peerConnectionRef.current.connectionState;

      if (state === "failed" || state === "disconnected") {
        // Reset connection on failure
        setTimeout(() => {
          if (isMountedRef.current && status === "connected") {
            console.log("Attempting to reconnect WebRTC...");
            createOffer();
          }
        }, 2000);
      }
    };

    // Handle ICE candidates
    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: "ice-candidate",
            payload: event.candidate,
            clientId,
          })
        );
      }
    };

    // Create offer after a delay to avoid race conditions
    setTimeout(() => {
      if (isMountedRef.current && peerConnectionRef.current) {
        createOffer();
      }
    }, 100);
  }, [createOffer, status, clientId]);

  // Initialize WebRTC connection
  const initializeConnection = useCallback(async () => {
    if (
      isInitializingRef.current ||
      wsRef.current?.readyState === WebSocket.OPEN ||
      !isMountedRef.current
    )
      return;

    isInitializingRef.current = true;
    setStatus("connecting");

    try {
      wsRef.current = new WebSocket(serverUrl);

      wsRef.current.onopen = () => {
        if (!isMountedRef.current) return;

        // Send clientId immediately
        if (wsRef.current) {
          wsRef.current.send(
            JSON.stringify({
              type: "client-registration",
              clientId: clientId,
              timestamp: new Date().toISOString(),
            })
          );
        }

        createPeerConnection();
        sendMessage("connection_status", {
          status: "connected",
          details: "WebSocket established",
        });
        isInitializingRef.current = false;
      };

      wsRef.current.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          await handleSignalingMessage(data);
        } catch (error) {
          console.error("Error handling WebSocket message:", error);
        }
      };

      wsRef.current.onclose = () => {
        if (!isMountedRef.current) return;
        setStatus("disconnected");
        isInitializingRef.current = false;
      };

      wsRef.current.onerror = () => {
        if (!isMountedRef.current) return;
        setStatus("error");
        isInitializingRef.current = false;
      };
    } catch (error) {
      console.error("Connection error:", error);
      setStatus("error");
      isInitializingRef.current = false;
    }
  }, [
    serverUrl,
    sendMessage,
    createPeerConnection,
    handleSignalingMessage,
    clientId,
  ]);

  // Optimized camera functions
  const startCamera = useCallback(async () => {
    if (!isMountedRef.current || streamRef.current) return false;

    setCameraStatus("starting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: frameRate, max: 60 },
        },
        audio: false,
      });

      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playError: unknown) {
          if (playError instanceof Error && playError.name !== "AbortError") {
            console.error("Video play error:", playError);
          }
        }
      }

      setCameraStatus("active");
      sendMessage("connection_status", {
        status: "connected",
        details: "Camera initialized",
      });
      return true;
    } catch (error) {
      console.error("Error accessing camera:", error);
      setCameraStatus("error");
      sendMessage("error", {
        message: `Camera error: ${error}`,
        code: "CAMERA_ACCESS_FAILED",
      });
      return false;
    }
  }, [frameRate, sendMessage]);

  // High-performance streaming with optimized frame capture
  const startStreaming = useCallback(() => {
    if (
      !streamRef.current ||
      !canvasRef.current ||
      !videoRef.current ||
      !isMountedRef.current
    )
      return;

    setCameraStatus("streaming");

    const captureFrame = () => {
      if (
        !videoRef.current ||
        !canvasRef.current ||
        !streamRef.current ||
        !isMountedRef.current
      )
        return;

      const now = performance.now();
      const timeSinceLastFrame = now - lastFrameTimeRef.current;
      const targetInterval = 1000 / frameRate;

      // Skip frame if we're capturing too fast
      if (timeSinceLastFrame < targetInterval * 0.8) {
        return;
      }

      lastFrameTimeRef.current = now;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Set canvas size to match video (optimized)
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.drawImage(video, 0, 0, width, height);

      // Convert to blob with optimized quality/compression ratio
      canvas.toBlob(
        (blob) => {
          if (blob && isMountedRef.current) {
            blob.arrayBuffer().then((buffer) => {
              sendBinaryFrame(buffer);
            });
          }
        },
        "image/jpeg",
        0.7 // Balanced quality vs size
      );
    };

    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current);
    }

    // Use high-frequency interval for smooth streaming
    streamingIntervalRef.current = window.setInterval(
      captureFrame,
      Math.max(16, 1000 / frameRate) // Minimum 16ms (60fps max)
    );
  }, [frameRate, sendBinaryFrame]);

  const stopStreaming = useCallback(() => {
    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current);
      streamingIntervalRef.current = null;
    }
    if (cameraStatus === "streaming" && isMountedRef.current) {
      setCameraStatus("active");
    }
  }, [cameraStatus]);

  const stopCamera = useCallback(() => {
    stopStreaming();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (isMountedRef.current) {
      setCameraStatus("inactive");
    }
  }, [stopStreaming]);

  const disconnect = useCallback(() => {
    stopCamera();

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (isMountedRef.current) {
      setStatus("disconnected");
    }
    isInitializingRef.current = false;
  }, [stopCamera]);

  // Auto-initialize on mount
  useEffect(() => {
    isMountedRef.current = true;
    initializeConnection();

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, []);

  // Handle autoStartCamera
  useEffect(() => {
    if (
      autoStartCamera &&
      status === "connected" &&
      cameraStatus === "inactive"
    ) {
      setTimeout(() => startCamera(), 500);
    }
  }, [autoStartCamera, status, cameraStatus, startCamera]);

  // Optimized heartbeat (less frequent)
  useEffect(() => {
    if (status !== "connected") {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      return;
    }

    if (!heartbeatIntervalRef.current) {
      heartbeatIntervalRef.current = window.setInterval(() => {
        sendMessage("heartbeat", { timestamp: new Date().toISOString() });
      }, 60000); // Reduced frequency to 1 minute
    }

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [status, sendMessage]);

  return (
    <div style={{ padding: "20px", maxWidth: "800px" }}>
      <h2>SkySentry Client: {clientId}</h2>

      <div style={{ marginBottom: "20px" }}>
        <p>
          Status:{" "}
          <strong
            style={{ color: status === "connected" ? "green" : "orange" }}
          >
            {status}
          </strong>
        </p>
        <p>
          Camera:{" "}
          <strong
            style={{
              color:
                cameraStatus === "streaming"
                  ? "green"
                  : cameraStatus === "active"
                  ? "blue"
                  : "orange",
            }}
          >
            {cameraStatus}
          </strong>
        </p>
        <p>
          Frame Rate: <strong>{frameRate} FPS</strong>
        </p>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={initializeConnection}
          disabled={status === "connected" || status === "connecting"}
          style={{ marginRight: "10px" }}
        >
          Connect
        </button>
        <button
          onClick={startCamera}
          disabled={cameraStatus !== "inactive"}
          style={{ marginRight: "10px" }}
        >
          Start Camera
        </button>
        <button
          onClick={startStreaming}
          disabled={cameraStatus !== "active"}
          style={{ marginRight: "10px" }}
        >
          Start Streaming
        </button>
        <button
          onClick={stopStreaming}
          disabled={cameraStatus !== "streaming"}
          style={{ marginRight: "10px" }}
        >
          Stop Streaming
        </button>
        <button
          onClick={stopCamera}
          disabled={cameraStatus === "inactive"}
          style={{ marginRight: "10px" }}
        >
          Stop Camera
        </button>
        <button onClick={disconnect}>Disconnect</button>
      </div>

      <div>
        <video
          ref={videoRef}
          style={{
            width: "640px",
            height: "480px",
            border: "1px solid #ccc",
            backgroundColor: "#000",
            display: cameraStatus === "inactive" ? "none" : "block",
          }}
          muted
          playsInline
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </div>
  );
};

export default SkySentryClient;
