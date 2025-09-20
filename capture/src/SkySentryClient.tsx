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
  frameRate = 10,
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

  const configuration: RTCConfiguration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  // Blackbox message sending function
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

        console.warn("No connection available to send message");
        return false;
      } catch (error) {
        console.error("Error sending message:", error);
        return false;
      }
    },
    [clientId]
  );

  const handleSignalingMessage = useCallback(
    async (data: any) => {
      if (!peerConnectionRef.current || !isMountedRef.current) return;

      try {
        const pc = peerConnectionRef.current;

        switch (data.type) {
          case "waiting-for-peer":
            console.log("Waiting for peer:", data.message);
            setStatus("connecting"); // Keep in connecting state while waiting
            return;

          case "offer":
            // Only handle offers if we're in the right state
            if (
              pc.signalingState !== "stable" &&
              pc.signalingState !== "have-remote-offer"
            ) {
              console.warn(`Ignoring offer in state: ${pc.signalingState}`);
              return;
            }

            console.log("Received offer, creating answer...");
            await pc.setRemoteDescription(data.payload);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            if (wsRef.current) {
              wsRef.current.send(
                JSON.stringify({
                  type: "answer",
                  payload: answer,
                  clientId, // Add clientId to signaling messages
                })
              );
            }
            break;

          case "answer":
            // Only handle answers if we're expecting one
            if (pc.signalingState !== "have-local-offer") {
              console.warn(`Ignoring answer in state: ${pc.signalingState}`);
              return;
            }

            console.log("Received answer, setting remote description...");
            await pc.setRemoteDescription(data.payload);
            break;

          case "ice-candidate":
            // Only add ICE candidates if we have a remote description
            if (pc.remoteDescription) {
              await pc.addIceCandidate(data.payload);
              console.log("Added ICE candidate");
            } else {
              // Queue the candidate for later if we don't have remote description yet
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
            clientId, // Add clientId to offer messages
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

    // Create data channel
    dataChannelRef.current = peerConnectionRef.current.createDataChannel(
      "messages",
      {
        ordered: true,
      }
    );

    dataChannelRef.current.onopen = () => {
      if (!isMountedRef.current) return;
      // Removed frequent data channel opened log
      setStatus("connected");
    };

    dataChannelRef.current.onclose = () => {
      // Removed frequent data channel closed log
    };

    // Handle incoming data channel
    peerConnectionRef.current.ondatachannel = (event) => {
      const channel = event.channel;
      channel.onmessage = (event) => {
        // Removed frequent P2P message log
      };
    };

    // Handle connection state changes
    peerConnectionRef.current.onconnectionstatechange = () => {
      if (!peerConnectionRef.current) return;
      const state = peerConnectionRef.current.connectionState;
      console.log(`WebRTC connection state: ${state}`);

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

    // Handle signaling state changes
    peerConnectionRef.current.onsignalingstatechange = () => {
      if (!peerConnectionRef.current) return;
      console.log(
        `WebRTC signaling state: ${peerConnectionRef.current.signalingState}`
      );
    };

    // Handle ICE candidates
    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: "ice-candidate",
            payload: event.candidate,
            clientId, // Add clientId to ICE candidate messages
          })
        );
      }
    };

    // Only create offer after a small delay to avoid race conditions
    setTimeout(() => {
      if (isMountedRef.current && peerConnectionRef.current) {
        createOffer();
      }
    }, 100);
  }, [createOffer, status]);

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

        // Send clientId immediately so backend can register us with the correct ID
        if (wsRef.current) {
          wsRef.current.send(
            JSON.stringify({
              type: "client-registration",
              clientId: clientId,
              timestamp: new Date().toISOString(),
            })
          );
        }

        // Removed frequent WebSocket connected log
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
        // Removed frequent WebSocket disconnected log
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
  }, [serverUrl, sendMessage, createPeerConnection, handleSignalingMessage]);

  // Camera functions
  const startCamera = useCallback(async () => {
    if (!isMountedRef.current || streamRef.current) return false;

    setCameraStatus("starting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, frameRate: frameRate },
        audio: false,
      });

      if (!isMountedRef.current) {
        // Component unmounted during async operation
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Use a promise-based approach for play() to handle interruptions
        try {
          await videoRef.current.play();
        } catch (playError: unknown) {
          if (playError instanceof Error && playError.name !== "AbortError") {
            console.error("Video play error:", playError);
          }
          // AbortError is expected when component is remounting, ignore it
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

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (blob && isMountedRef.current) {
            blob.arrayBuffer().then((buffer) => {
              sendMessage("webcam_frame", {
                data: Array.from(new Uint8Array(buffer)).join(","),
                size: buffer.byteLength,
                format: "jpeg",
              });
            });
          }
        },
        "image/jpeg",
        0.8
      );
    };

    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current);
    }
    streamingIntervalRef.current = window.setInterval(
      captureFrame,
      1000 / frameRate
    );
  }, [frameRate, sendMessage]);

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

  // Auto-initialize on mount - only run once
  useEffect(() => {
    isMountedRef.current = true;
    initializeConnection();

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, []); // Empty dependency array - only run once on mount

  // Handle autoStartCamera separately to avoid re-initialization
  useEffect(() => {
    if (
      autoStartCamera &&
      status === "connected" &&
      cameraStatus === "inactive"
    ) {
      setTimeout(() => startCamera(), 500); // Small delay to ensure connection is stable
    }
  }, [autoStartCamera, status, cameraStatus, startCamera]);

  // Send heartbeat when connected
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
      }, 30000);
    }

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [status, sendMessage]);

  return (
    <div style={{ padding: "20px", maxWidth: "600px" }}>
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
            width: "320px",
            height: "240px",
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
