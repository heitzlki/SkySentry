import { useState, useEffect, useRef, useCallback } from "react";

interface SkySentryClientProps {
  clientId: string;
  serverUrl?: string;
  frameRate?: number;
}

const SkySentryClient: React.FC<SkySentryClientProps> = ({
  clientId,
  serverUrl = import.meta.env.VITE_WEBSOCKET_URL ||
    "wss://demo8080.shivi.io/ws",
  frameRate = 30, // Increased for lower latency
}) => {
  const [status, setStatus] = useState<
    "disconnected" | "connecting" | "connected" | "error"
  >("disconnected");
  const [cameraStatus, setCameraStatus] = useState<
    "inactive" | "active" | "streaming" | "error"
  >("inactive");
  const [fps, setFps] = useState(0);
  const [droppedFrames, setDroppedFrames] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const sentFrameCountRef = useRef(0);
  const droppedFramesRef = useRef(0);
  const lastFpsUpdateTimeRef = useRef(performance.now());
  const lastSendTimeRef = useRef(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setStatus("connecting");
    console.log("Connecting to WebSocket:", serverUrl);
    wsRef.current = new WebSocket(serverUrl);
    wsRef.current.onopen = () => {
      console.log("WebSocket connected to", serverUrl);
      setStatus("connected");
      wsRef.current?.send(
        JSON.stringify({ type: "client-registration", clientId })
      );
    };
    wsRef.current.onclose = (event) => {
      console.log(
        "WebSocket closed, code:",
        event.code,
        "reason:",
        event.reason
      );
      setStatus("disconnected");
    };
    wsRef.current.onerror = (event) => {
      console.error("WebSocket error:", event);
      setStatus("error");
    };
  }, [serverUrl, clientId]);

  const startCamera = useCallback(async () => {
    if (streamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: frameRate },
        },
        audio: false,
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
      streamRef.current = stream;
      setCameraStatus("active");
    } catch (error) {
      console.error("Camera error:", error);
      setCameraStatus("error");
    }
  }, [frameRate]);

  const captureAndSendFrame = useCallback(() => {
    const now = performance.now();
    if (now - lastSendTimeRef.current < 1000 / frameRate) return;
    lastSendTimeRef.current = now;

    const ws = wsRef.current;
    // Aggressive check: if network is backed up, don't even bother capturing.
    if (
      !ws ||
      ws.readyState !== WebSocket.OPEN ||
      ws.bufferedAmount > 1024 * 256
    ) {
      // 256KB buffer limit
      droppedFramesRef.current++;
      return;
    }

    if (!videoRef.current || !canvasRef.current || videoRef.current.paused)
      return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(blob);
          sentFrameCountRef.current++;
        } else {
          droppedFramesRef.current++;
        }
      },
      "image/jpeg",
      0.4 // Reduced quality for better performance and lower bandwidth
    );
  }, [frameRate]);

  const streamingLoop = useCallback(() => {
    captureAndSendFrame();

    const now = performance.now();
    if (now - lastFpsUpdateTimeRef.current >= 1000) {
      setFps(sentFrameCountRef.current);
      setDroppedFrames(droppedFramesRef.current);
      sentFrameCountRef.current = 0;
      droppedFramesRef.current = 0;
      lastFpsUpdateTimeRef.current = now;
    }

    animationFrameRef.current = requestAnimationFrame(streamingLoop);
  }, [captureAndSendFrame]);

  const startStreaming = () => {
    if (cameraStatus !== "active" || animationFrameRef.current) return;
    setCameraStatus("streaming");
    animationFrameRef.current = requestAnimationFrame(streamingLoop);
  };

  const stopStreaming = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setCameraStatus("active");
    setFps(0);
  };

  const disconnect = () => {
    stopStreaming();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    wsRef.current?.close();
    setCameraStatus("inactive");
  };

  useEffect(() => {
    return () => disconnect(); // Cleanup on unmount
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h2>Capture Client: {clientId}</h2>
      <div>
        <p>
          Server: <strong>{status.toUpperCase()}</strong>
        </p>
        <p>
          Camera: <strong>{cameraStatus.toUpperCase()}</strong>
        </p>
        {cameraStatus === "streaming" && (
          <p>
            Performance: <strong>{fps} FPS</strong> | Dropped:{" "}
            <strong>{droppedFrames}</strong>
          </p>
        )}
      </div>
      <div style={{ margin: "20px 0" }}>
        <button onClick={connect} disabled={status !== "disconnected"}>
          Connect
        </button>
        <button
          onClick={startCamera}
          disabled={status !== "connected" || cameraStatus !== "inactive"}
        >
          Start Camera
        </button>
        <button onClick={startStreaming} disabled={cameraStatus !== "active"}>
          Start Streaming
        </button>
        <button onClick={stopStreaming} disabled={cameraStatus !== "streaming"}>
          Stop Streaming
        </button>
        <button onClick={disconnect}>Disconnect All</button>
      </div>
      <div>
        <video
          ref={videoRef}
          style={{ width: "640px", height: "480px", border: "1px solid black" }}
          autoPlay
          muted
          playsInline
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </div>
  );
};

export default SkySentryClient;
