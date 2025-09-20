"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Play, Square } from "lucide-react";

interface CameraData {
  id: string;
  image: string | null;
  timestamp: string | null;
  frameNumber: number;
  size: number;
  status: "online" | "offline";
}

interface CameraCardProps {
  camera: CameraData;
  isStreaming: boolean;
}

export function CameraGrid() {
  const [cameras, setCameras] = useState<CameraData[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [frameStats, setFrameStats] = useState<
    Record<string, { fps: number; lastFrameTime: number; frameCount: number }>
  >({});

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const frameStatsRef = useRef<
    Record<
      string,
      {
        lastFrameTime: number;
        frameCount: number;
        fpsHistory: number[];
        lastFrameTimestamp: string; // Track last frame timestamp to prevent out-of-order
        lastProcessedTime: number; // Track when we last processed a frame
        droppedFrames: number; // Track dropped frames for performance
        connectionQuality: "good" | "poor" | "degraded"; // Track connection quality
      }
    >
  >({});

  // Dynamic FPS adjustment based on performance
  const [currentDisplayFPS, setCurrentDisplayFPS] = useState(15);
  const performanceCheckRef = useRef<NodeJS.Timeout | null>(null);

  // Adaptive frame processing rate - starts at 15 FPS, can adjust dynamically
  const MIN_FRAME_INTERVAL = 1000 / currentDisplayFPS;

  // Performance monitoring and dynamic adjustment
  const adjustDisplayFPS = useCallback(() => {
    const stats = Object.values(frameStatsRef.current);
    if (stats.length === 0) return;

    const avgDroppedFrames =
      stats.reduce((sum, stat) => sum + stat.droppedFrames, 0) / stats.length;
    const totalCameras = stats.length;

    // Adjust FPS based on performance
    let newFPS = currentDisplayFPS;

    if (avgDroppedFrames > 5 && totalCameras > 2) {
      // Many dropped frames with multiple cameras - reduce FPS
      newFPS = Math.max(8, currentDisplayFPS - 2);
    } else if (avgDroppedFrames < 1 && totalCameras <= 2) {
      // Good performance with few cameras - can increase FPS
      newFPS = Math.min(20, currentDisplayFPS + 1);
    } else if (totalCameras > 4) {
      // Many cameras - cap at lower FPS
      newFPS = Math.min(12, currentDisplayFPS);
    }

    if (newFPS !== currentDisplayFPS) {
      setCurrentDisplayFPS(newFPS);
      console.log(
        `📊 Adjusted display FPS to ${newFPS} (cameras: ${totalCameras}, avg dropped: ${avgDroppedFrames.toFixed(
          1
        )})`
      );
    }
  }, [currentDisplayFPS]);

  // Calculate FPS for each camera
  const updateFrameStats = useCallback((clientId: string) => {
    const now = Date.now();
    const stats = frameStatsRef.current[clientId] || {
      lastFrameTime: now,
      frameCount: 0,
      fpsHistory: [],
      lastFrameTimestamp: "",
      lastProcessedTime: 0,
      droppedFrames: 0,
      connectionQuality: "good" as const,
    };

    stats.frameCount++;
    const timeDiff = now - stats.lastFrameTime;

    if (timeDiff >= 1000) {
      // Update FPS every second
      const fps = Math.round((stats.frameCount * 1000) / timeDiff);
      stats.fpsHistory.push(fps);

      // Keep only last 5 measurements for smoothing
      if (stats.fpsHistory.length > 5) {
        stats.fpsHistory.shift();
      }

      const avgFps =
        stats.fpsHistory.reduce((a, b) => a + b, 0) / stats.fpsHistory.length;

      // Update connection quality based on FPS consistency
      const fpsVariance =
        Math.max(...stats.fpsHistory) - Math.min(...stats.fpsHistory);
      if (avgFps < 5 || fpsVariance > 10) {
        stats.connectionQuality = "poor";
      } else if (avgFps < 10 || fpsVariance > 5) {
        stats.connectionQuality = "degraded";
      } else {
        stats.connectionQuality = "good";
      }

      setFrameStats((prev) => ({
        ...prev,
        [clientId]: {
          fps: Math.round(avgFps),
          lastFrameTime: now,
          frameCount: stats.frameCount,
        },
      }));

      stats.lastFrameTime = now;
      stats.frameCount = 0;
    }

    frameStatsRef.current[clientId] = stats;
  }, []);

  // WebSocket streaming connection with improved reconnection
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      // Connect to the Golang server streaming endpoint using environment variable
      const streamingUrl =
        process.env.NEXT_PUBLIC_WS_STREAM_URL ||
        "ws://localhost:8080/stream/ws";
      wsRef.current = new WebSocket(streamingUrl);

      // Add connection timeout
      const connectionTimeout = setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
          console.log("⏰ WebSocket connection timeout");
        }
      }, 10000); // 10 second timeout

      wsRef.current.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log("Connected to streaming server");
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Clear reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        // Start performance monitoring
        if (performanceCheckRef.current) {
          clearInterval(performanceCheckRef.current);
        }
        performanceCheckRef.current = setInterval(adjustDisplayFPS, 5000); // Check every 5 seconds
      };

      wsRef.current.onmessage = (event) => {
        try {
          // Handle JSON messages from the Golang server
          if (typeof event.data === "string") {
            const data = JSON.parse(event.data);

            if (data.type === "frame_update") {
              const now = Date.now();
              const currentStats = frameStatsRef.current[data.clientId] || {
                lastFrameTime: now,
                frameCount: 0,
                fpsHistory: [],
                lastFrameTimestamp: "",
                lastProcessedTime: 0,
                droppedFrames: 0,
                connectionQuality: "good" as const,
              };

              // Rate limiting with dynamic FPS
              const timeSinceLastProcessed =
                now - currentStats.lastProcessedTime;
              if (timeSinceLastProcessed < MIN_FRAME_INTERVAL * 0.9) {
                // 90% of target interval
                currentStats.droppedFrames++;
                frameStatsRef.current[data.clientId] = currentStats;
                return; // Silently drop - don't log every dropped frame
              }

              // Check if this frame is newer than the last one we processed
              if (currentStats.lastFrameTimestamp && data.timestamp) {
                const newTimestamp = new Date(data.timestamp).getTime();
                const lastTimestamp = new Date(
                  currentStats.lastFrameTimestamp
                ).getTime();

                // Skip if this frame is older than the last one we processed
                if (newTimestamp <= lastTimestamp) {
                  return; // Silently drop out-of-order frames
                }
              }

              // Update the last processed time
              currentStats.lastProcessedTime = now;
              currentStats.lastFrameTimestamp = data.timestamp;
              frameStatsRef.current[data.clientId] = currentStats;

              // Update camera data with new frame using functional update to prevent race conditions
              setCameras((prevCameras) => {
                const existingCameraIndex = prevCameras.findIndex(
                  (camera) => camera.id === data.clientId
                );

                const updatedCamera = {
                  id: data.clientId,
                  image: data.image, // Already base64 encoded data URL
                  status: "online" as const,
                  timestamp: data.timestamp,
                  size: data.size,
                  frameNumber: data.stats?.frameCount || 0, // Use backend frame count
                };

                if (existingCameraIndex >= 0) {
                  // Update existing camera
                  const newCameras = [...prevCameras];
                  newCameras[existingCameraIndex] = updatedCamera;

                  // Update frame stats
                  updateFrameStats(data.clientId);

                  return newCameras;
                } else {
                  // Add new camera and initialize frame stats
                  updateFrameStats(data.clientId);
                  return [...prevCameras, updatedCamera];
                }
              });

              setError(null);
              setLastUpdate(new Date());
            } else {
              console.log("Received control message:", data);
            }
          }
        } catch (error) {
          console.error("Error handling WebSocket message:", error);
        }
      };

      wsRef.current.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log(`Streaming connection closed (code: ${event.code})`);

        // Stop performance monitoring
        if (performanceCheckRef.current) {
          clearInterval(performanceCheckRef.current);
          performanceCheckRef.current = null;
        }

        // Implement exponential backoff for reconnection
        if (isStreaming && reconnectAttemptsRef.current < 10) {
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttemptsRef.current),
            30000
          ); // Max 30 seconds
          reconnectAttemptsRef.current++;

          console.log(
            `🔄 Attempting reconnection ${reconnectAttemptsRef.current}/10 in ${delay}ms`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, delay);
        } else if (reconnectAttemptsRef.current >= 10) {
          setError(
            "Connection lost. Too many reconnection attempts. Please refresh the page."
          );
        }
      };

      wsRef.current.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error("WebSocket error:", error);
        setError(
          "Connection to streaming server failed. Attempting to reconnect..."
        );
      };
    } catch (error) {
      console.error("Failed to connect to streaming server:", error);
      setError("Failed to connect to streaming server");
    }
  }, [isStreaming, updateFrameStats, MIN_FRAME_INTERVAL, adjustDisplayFPS]);

  // Fallback HTTP API fetch using Golang server (only when WebSocket is not active)
  const fetchCameras = useCallback(async () => {
    try {
      // Use Golang server API endpoints with environment variable
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";
      const response = await fetch(`${apiUrl}/clients`);
      const clientsData = await response.json();

      if (!clientsData.success) {
        throw new Error("Failed to fetch clients");
      }

      // Fetch latest frame for each client
      const cameraPromises = clientsData.clients.map(
        async (clientId: string) => {
          try {
            const frameResponse = await fetch(
              `${apiUrl}/clients/${clientId}/latest`
            );
            const frameData = await frameResponse.json();

            if (frameData.success) {
              return {
                id: clientId,
                image: frameData.image,
                timestamp: frameData.timestamp,
                frameNumber: frameData.stats?.frameCount || 0, // Use backend frame count
                size: frameData.size || 0,
                status: "online" as const,
              };
            } else {
              return {
                id: clientId,
                image: null,
                timestamp: null,
                frameNumber: 0,
                size: 0,
                status: "offline" as const,
              };
            }
          } catch {
            return {
              id: clientId,
              image: null,
              timestamp: null,
              frameNumber: 0,
              size: 0,
              status: "offline" as const,
            };
          }
        }
      );

      const newCameras = await Promise.all(cameraPromises);

      // Sort cameras by ID for consistent display order
      const sortedCameras = newCameras.sort((a, b) => a.id.localeCompare(b.id));

      setCameras(sortedCameras);
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      setError("Network error: Could not connect to Golang server");
      console.error("Failed to fetch cameras:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  // Only poll when NOT streaming via WebSocket
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;

    if (!isStreaming) {
      // Only poll when WebSocket streaming is inactive
      pollInterval = setInterval(() => {
        fetchCameras();
      }, 2000); // Slower polling when not actively streaming
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isStreaming, fetchCameras]);

  // Handle streaming toggle
  const toggleStreaming = useCallback(() => {
    setIsStreaming((prev) => {
      const newStreaming = !prev;

      if (newStreaming) {
        // Start WebSocket streaming
        connectWebSocket();
      } else {
        // Stop WebSocket streaming
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        // Clear frame stats
        setFrameStats({});
        frameStatsRef.current = {};

        // Resume HTTP polling
        fetchCameras();
      }

      return newStreaming;
    });
  }, [connectWebSocket, fetchCameras]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (performanceCheckRef.current) {
        clearInterval(performanceCheckRef.current);
      }
    };
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    fetchCameras();
  };

  if (loading && cameras.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading cameras...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold">Camera Streams</h2>
          <Badge variant={cameras.length > 0 ? "default" : "secondary"}>
            {cameras.length} {cameras.length === 1 ? "Camera" : "Cameras"}
          </Badge>
          {isStreaming && (
            <Badge variant="destructive" className="animate-pulse">
              🔴 LIVE STREAMING
            </Badge>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {lastUpdate && (
            <span className="text-sm text-muted-foreground">
              Last update: {lastUpdate.toLocaleTimeString()}
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading || isStreaming}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <Button
            onClick={toggleStreaming}
            variant={isStreaming ? "destructive" : "default"}
            size="sm"
            className="min-w-[120px]"
          >
            {isStreaming ? (
              <>
                <Square className="h-4 w-4 mr-2" />
                Stop Stream
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Stream
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-destructive font-medium">Error: {error}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {isStreaming
              ? "Trying to reconnect..."
              : "Try refreshing or check server connection"}
          </p>
        </div>
      )}

      {/* Camera Grid */}
      {cameras.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">No cameras connected</p>
          <p className="text-sm text-muted-foreground">
            Start a camera client to see streams here
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {cameras.map((camera) => (
            <CameraCard
              key={camera.id}
              camera={camera}
              isStreaming={isStreaming}
              frameStats={frameStats[camera.id]}
            />
          ))}
        </div>
      )}

      {/* Performance Info */}
      {isStreaming && Object.keys(frameStats).length > 0 && (
        <div className="bg-muted/50 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Performance Stats</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {Object.entries(frameStats).map(([clientId, stats]) => (
              <div key={clientId} className="text-center">
                <div className="font-medium">{clientId}</div>
                <div className="text-green-600">{stats.fps} FPS</div>
                <div className="text-muted-foreground">
                  {stats.frameCount} frames
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CameraCard({
  camera,
  isStreaming,
  frameStats,
}: CameraCardProps & {
  frameStats?: { fps: number; lastFrameTime: number; frameCount: number };
}) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
      {/* Camera feed */}
      <div className="aspect-video bg-muted relative">
        {camera.image && !imageError ? (
          <>
            <img
              src={camera.image}
              alt={`Camera ${camera.id}`}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
              onLoad={() => setImageError(false)}
            />

            {/* Status indicator */}
            <div className="absolute top-2 left-2">
              <Badge
                variant={camera.status === "online" ? "default" : "secondary"}
                className={camera.status === "online" ? "bg-green-600" : ""}
              >
                {camera.status === "online" ? "●" : "○"}{" "}
                {camera.status.toUpperCase()}
              </Badge>
            </div>

            {/* Streaming indicator */}
            {isStreaming && camera.status === "online" && (
              <div className="absolute top-2 right-2">
                <div className="flex items-center space-x-1 bg-red-600 text-white px-2 py-1 rounded text-xs">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span>LIVE</span>
                  {frameStats && (
                    <span className="ml-1">{frameStats.fps}fps</span>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl mb-2">📹</div>
              <p className="text-sm text-muted-foreground">
                {camera.status === "offline" ? "Camera Offline" : "No Signal"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Camera info */}
      <div className="p-3 bg-muted/30">
        <div className="flex justify-between items-center mb-1">
          <span className="font-medium truncate">Camera {camera.id}</span>
          {frameStats && (
            <span className="text-xs text-green-600 font-mono">
              {frameStats.fps} FPS
            </span>
          )}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Frame: {camera.frameNumber}</span>
          <span>{(camera.size / 1024).toFixed(1)} KB</span>
        </div>
        {camera.timestamp && (
          <div className="text-xs text-muted-foreground mt-1">
            {new Date(camera.timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
