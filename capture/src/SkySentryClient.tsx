import { useState, useEffect, useRef, useCallback } from "react";

interface SkySentryClientProps {
  clientId: string;
  serverUrl?: string;
  autoStartCamera?: boolean;
  frameRate?: number;
}

interface CameraDevice {
  deviceId: string;
  label: string;
}

const SkySentryClient: React.FC<SkySentryClientProps> = ({
  clientId,
  serverUrl,
  autoStartCamera = false,
  frameRate = 30,
}) => {
  // Get environment variable with proper fallback
  const wsUrl =
    serverUrl || import.meta.env.VITE_WEBSOCKET_URL || "ws://localhost:8080/ws";

  // Debug logging
  console.log("Environment variables debug:", {
    all: import.meta.env,
    websocketUrl: import.meta.env.VITE_WEBSOCKET_URL,
    finalUrl: wsUrl,
  });

  const [status, setStatus] = useState<
    "disconnected" | "connecting" | "connected" | "error"
  >("disconnected");
  const [cameraStatus, setCameraStatus] = useState<
    "inactive" | "starting" | "active" | "streaming" | "error"
  >("inactive");
  const [frameCount, setFrameCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [autoConnect, setAutoConnect] = useState(autoStartCamera);

  const wsRef = useRef<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const streamingIntervalRef = useRef<number | null>(null);
  const isInitializingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const fpsIntervalRef = useRef<number | null>(null);

  // Add frame drop prevention refs
  const pendingFramesRef = useRef<number>(0);
  const droppedFramesRef = useRef<number>(0);
  const lastSuccessfulSendRef = useRef<number>(0);
  const [droppedFrames, setDroppedFrames] = useState(0);

  // Enumerate available cameras
  const enumerateCameras = useCallback(async () => {
    try {
      // Request permissions first
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter((device) => device.kind === "videoinput")
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 8)}...`,
        }));

      setAvailableCameras(videoDevices);

      // Select first camera by default if none selected
      if (videoDevices.length > 0 && !selectedCameraId) {
        setSelectedCameraId(videoDevices[0].deviceId);
      }
    } catch (error) {
      console.error("Error enumerating cameras:", error);
      setAvailableCameras([]);
    }
  }, [selectedCameraId]);

  // Connect to WebSocket server
  const connect = useCallback(async () => {
    if (
      isInitializingRef.current ||
      wsRef.current?.readyState === WebSocket.OPEN ||
      !isMountedRef.current
    )
      return;

    isInitializingRef.current = true;
    setStatus("connecting");

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        if (!isMountedRef.current) return;

        // Register client immediately
        const registrationMessage = {
          type: "client-registration",
          clientId: clientId,
          timestamp: new Date(),
        };

        wsRef.current?.send(JSON.stringify(registrationMessage));
        console.log(`🔗 Attempting to register with server as ${clientId}`);
      };

      // Add message handler for server responses
      wsRef.current.onmessage = (event) => {
        if (!isMountedRef.current) return;

        try {
          const message = JSON.parse(event.data);

          if (message.type === "registration-success") {
            setStatus("connected");
            isInitializingRef.current = false;
            console.log(
              `✅ Successfully registered with server as ${message.clientId}`
            );
          } else {
            console.log("📨 Received server message:", message);
          }
        } catch (error) {
          // Ignore non-JSON messages (binary data, etc.)
        }
      };

      wsRef.current.onclose = () => {
        if (!isMountedRef.current) return;
        setStatus("disconnected");
        isInitializingRef.current = false;
        console.log("🔌 Disconnected from SkySentry server");
      };

      wsRef.current.onerror = (error) => {
        if (!isMountedRef.current) return;
        setStatus("error");
        isInitializingRef.current = false;
        console.error("WebSocket error:", error);
      };
    } catch (error) {
      console.error("Connection error:", error);
      setStatus("error");
      isInitializingRef.current = false;
    }
  }, [wsUrl, clientId]);

  // Start camera with selected device
  const startCamera = useCallback(async () => {
    if (!isMountedRef.current || streamRef.current) return false;

    setCameraStatus("starting");

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 480, max: 640 }, // Reduced from 640/1280 to 480/640
          height: { ideal: 360, max: 480 }, // Reduced from 480/720 to 360/480
          frameRate: { ideal: Math.min(frameRate, 20), max: 30 }, // Cap at 20 FPS ideal, 30 max
        },
        audio: false,
      };

      // Add device constraint if specific camera is selected
      if (selectedCameraId) {
        (constraints.video as MediaTrackConstraints).deviceId = {
          exact: selectedCameraId,
        };
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

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
      console.log("Camera initialized successfully with optimized resolution");
      return true;
    } catch (error) {
      console.error("Error accessing camera:", error);
      setCameraStatus("error");
      return false;
    }
  }, [frameRate, selectedCameraId]);

  // Send binary frame directly via WebSocket with buffering control
  const sendFrame = useCallback((frameData: Uint8Array) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn(
        "⚠️ WebSocket not ready, dropping frame. State:",
        ws?.readyState
      );
      droppedFramesRef.current++;
      setDroppedFrames(droppedFramesRef.current);
      return;
    }

    // Check WebSocket buffer - if bufferedAmount is too high, drop frame
    const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB buffer limit
    if (ws.bufferedAmount > MAX_BUFFER_SIZE) {
      console.warn(
        `⚠️ WebSocket buffer full (${ws.bufferedAmount} bytes), dropping frame`
      );
      droppedFramesRef.current++;
      setDroppedFrames(droppedFramesRef.current);
      return;
    }

    // Check if too many frames are pending
    if (pendingFramesRef.current > 3) {
      console.warn("⚠️ Too many pending frames, dropping frame");
      droppedFramesRef.current++;
      setDroppedFrames(droppedFramesRef.current);
      return;
    }

    try {
      ws.send(frameData);
      frameCountRef.current++;
      lastSuccessfulSendRef.current = performance.now();
      console.log(
        `📸 Sent frame: ${frameData.length} bytes (buffer: ${ws.bufferedAmount})`
      );
    } catch (error) {
      console.error("❌ Failed to send frame:", error);
      droppedFramesRef.current++;
      setDroppedFrames(droppedFramesRef.current);
    }
  }, []);

  // Capture and send frames with optimized async handling
  const captureFrame = useCallback(() => {
    if (
      !videoRef.current ||
      !canvasRef.current ||
      !streamRef.current ||
      !isMountedRef.current
    ) {
      return;
    }

    const now = performance.now();
    const timeSinceLastFrame = now - lastFrameTimeRef.current;
    const targetInterval = 1000 / frameRate;

    // Skip frame if we're capturing too fast
    if (timeSinceLastFrame < targetInterval * 0.9) {
      return;
    }

    // Check if WebSocket is backed up before capturing
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // Skip if buffer is getting full
    if (ws.bufferedAmount > 512 * 1024) {
      // 512KB threshold
      droppedFramesRef.current++;
      setDroppedFrames(droppedFramesRef.current);
      return;
    }

    lastFrameTimeRef.current = now;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("❌ Cannot get canvas context");
      return;
    }

    // Set canvas size to match video
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      console.log(`📐 Canvas resized to ${width}x${height}`);
    }

    ctx.drawImage(video, 0, 0, width, height);

    // Increment pending frames counter
    pendingFramesRef.current++;

    // Convert to JPEG blob with improved error handling
    canvas.toBlob(
      (blob) => {
        // Decrement pending frames counter
        pendingFramesRef.current = Math.max(0, pendingFramesRef.current - 1);

        if (!blob || !isMountedRef.current) {
          droppedFramesRef.current++;
          setDroppedFrames(droppedFramesRef.current);
          return;
        }

        // Use faster conversion with better error handling
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result instanceof ArrayBuffer) {
            sendFrame(new Uint8Array(e.target.result));
          } else {
            droppedFramesRef.current++;
            setDroppedFrames(droppedFramesRef.current);
          }
        };
        reader.onerror = () => {
          droppedFramesRef.current++;
          setDroppedFrames(droppedFramesRef.current);
        };
        reader.readAsArrayBuffer(blob);
      },
      "image/jpeg",
      0.6 // Slightly lower quality for better performance
    );
  }, [frameRate, sendFrame]);

  // Start streaming
  const startStreaming = useCallback(() => {
    if (
      !streamRef.current ||
      !canvasRef.current ||
      !videoRef.current ||
      !isMountedRef.current
    )
      return;

    setCameraStatus("streaming");
    setFrameCount(0);
    frameCountRef.current = 0;

    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current);
    }

    // Start FPS counter
    if (fpsIntervalRef.current) {
      clearInterval(fpsIntervalRef.current);
    }
    fpsIntervalRef.current = window.setInterval(() => {
      setFps(frameCountRef.current);
      setFrameCount(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1000);

    // High-frequency frame capture
    streamingIntervalRef.current = window.setInterval(
      captureFrame,
      Math.max(16, 1000 / frameRate) // Minimum 16ms (60fps max)
    );

    console.log(`Started streaming at ${frameRate} FPS`);
  }, [frameRate, captureFrame]);

  // Stop streaming
  const stopStreaming = useCallback(() => {
    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current);
      streamingIntervalRef.current = null;
    }
    if (fpsIntervalRef.current) {
      clearInterval(fpsIntervalRef.current);
      fpsIntervalRef.current = null;
    }
    if (cameraStatus === "streaming" && isMountedRef.current) {
      setCameraStatus("active");
      setFps(0);
    }
    console.log("Stopped streaming");
  }, [cameraStatus]);

  // Stop camera
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
    console.log("Camera stopped");
  }, [stopStreaming]);

  // Disconnect from server
  const disconnect = useCallback(() => {
    stopCamera();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (isMountedRef.current) {
      setStatus("disconnected");
    }
    isInitializingRef.current = false;
    console.log("Disconnected from server");
  }, [stopCamera]);

  // Initialize cameras on mount
  useEffect(() => {
    isMountedRef.current = true;
    enumerateCameras();

    // Only auto-connect if explicitly enabled
    if (autoConnect) {
      connect();
    }

    return () => {
      isMountedRef.current = false;
      // Don't call disconnect here as it causes immediate disconnection
      // Instead, just stop camera and close websocket
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
        streamingIntervalRef.current = null;
      }

      if (fpsIntervalRef.current) {
        clearInterval(fpsIntervalRef.current);
        fpsIntervalRef.current = null;
      }
    };
  }, []); // Empty dependency array to prevent re-running

  // Auto-start camera if requested and camera is selected
  useEffect(() => {
    if (
      autoConnect &&
      status === "connected" &&
      cameraStatus === "inactive" &&
      selectedCameraId
    ) {
      setTimeout(() => startCamera(), 500);
    }
  }, [autoConnect, status, cameraStatus, selectedCameraId, startCamera]);

  return (
    <div style={{ padding: "20px", maxWidth: "800px" }}>
      <h2>SkySentry Capture Client: {clientId}</h2>

      <div style={{ marginBottom: "20px" }}>
        <p>
          Server Status:{" "}
          <strong
            style={{
              color:
                status === "connected"
                  ? "green"
                  : status === "error"
                  ? "red"
                  : "orange",
            }}
          >
            {status.toUpperCase()}
          </strong>
        </p>
        <p>
          Camera Status:{" "}
          <strong
            style={{
              color:
                cameraStatus === "streaming"
                  ? "green"
                  : cameraStatus === "active"
                  ? "blue"
                  : cameraStatus === "error"
                  ? "red"
                  : "orange",
            }}
          >
            {cameraStatus.toUpperCase()}
          </strong>
        </p>
        {cameraStatus === "streaming" && (
          <p>
            Performance: <strong>{fps} FPS</strong> | Frames sent:{" "}
            <strong>{frameCount}</strong> | Dropped:{" "}
            <strong style={{ color: droppedFrames > 0 ? "red" : "green" }}>
              {droppedFrames}
            </strong>
          </p>
        )}
        <p>
          Target Frame Rate: <strong>{frameRate} FPS</strong>
        </p>
      </div>

      {/* Camera Selection */}
      <div style={{ marginBottom: "20px" }}>
        <h3>Camera Selection:</h3>
        <div style={{ marginBottom: "10px" }}>
          <button
            onClick={enumerateCameras}
            disabled={cameraStatus !== "inactive"}
            style={{ marginRight: "10px" }}
          >
            🔍 Refresh Cameras
          </button>
          {availableCameras.length > 0 && (
            <select
              value={selectedCameraId}
              onChange={(e) => setSelectedCameraId(e.target.value)}
              disabled={cameraStatus !== "inactive"}
              style={{
                padding: "5px 10px",
                marginRight: "10px",
                minWidth: "200px",
              }}
            >
              {availableCameras.map((camera) => (
                <option key={camera.deviceId} value={camera.deviceId}>
                  {camera.label}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <input
              type="checkbox"
              checked={autoConnect}
              onChange={(e) => setAutoConnect(e.target.checked)}
            />
            Auto-connect and start camera
          </label>
        </div>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={connect}
          disabled={status === "connected" || status === "connecting"}
          style={{ marginRight: "10px" }}
        >
          Connect to Server
        </button>
        <button
          onClick={startCamera}
          disabled={
            status !== "connected" ||
            cameraStatus !== "inactive" ||
            !selectedCameraId
          }
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
        <button
          onClick={disconnect}
          style={{ backgroundColor: "#ff4444", color: "white" }}
        >
          Disconnect
        </button>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h3>Live Preview:</h3>
        {availableCameras.length === 0 && cameraStatus === "inactive" && (
          <div
            style={{
              padding: "10px",
              backgroundColor: "#fff3cd",
              border: "1px solid #ffeaa7",
              borderRadius: "4px",
              marginBottom: "10px",
            }}
          >
            📹 Click "Refresh Cameras" to detect available cameras
          </div>
        )}
        <video
          ref={videoRef}
          style={{
            width: "640px",
            height: "480px",
            border: "2px solid #ccc",
            backgroundColor: "#000",
            display: cameraStatus === "inactive" ? "none" : "block",
            borderColor: cameraStatus === "streaming" ? "#00ff00" : "#ccc",
          }}
          muted
          playsInline
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {cameraStatus === "inactive" && (
          <div
            style={{
              width: "640px",
              height: "480px",
              border: "2px solid #ccc",
              backgroundColor: "#f0f0f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              color: "#666",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            📹 Camera Not Active
            {selectedCameraId && (
              <div style={{ fontSize: "14px", textAlign: "center" }}>
                Selected:{" "}
                {availableCameras.find((c) => c.deviceId === selectedCameraId)
                  ?.label || "Unknown"}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ fontSize: "0.9em", color: "#666" }}>
        <h3>Instructions:</h3>
        <ol>
          <li>Click "Refresh Cameras" to detect available cameras</li>
          <li>Select your preferred camera from the dropdown</li>
          <li>Click "Connect to Server" to establish WebSocket connection</li>
          <li>Click "Start Camera" to access your selected webcam</li>
          <li>Click "Start Streaming" to begin sending frames to the server</li>
          <li>
            Use the auto-connect checkbox to automatically connect on page load
          </li>
        </ol>
      </div>
    </div>
  );
};

export default SkySentryClient;
