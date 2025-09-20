"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Play, Square } from "lucide-react";
import { api } from "@/lib/api-client";

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
  const frameStatsRef = useRef<
    Record<
      string,
      { lastFrameTime: number; frameCount: number; fpsHistory: number[] }
    >
  >({});

  // Calculate FPS for each camera
  const updateFrameStats = useCallback((clientId: string) => {
    const now = Date.now();
    const stats = frameStatsRef.current[clientId] || {
      lastFrameTime: now,
      frameCount: 0,
      fpsHistory: [],
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

  // WebSocket streaming connection
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      // Connect to streaming server
      const streamingUrl = `ws://localhost:8081`;
      wsRef.current = new WebSocket(streamingUrl);

      wsRef.current.onopen = () => {
        console.log("Connected to streaming server");
        setError(null);

        // Clear reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "frame_update") {
            const cameraData: CameraData = {
              id: data.clientId,
              image: `data:image/jpeg;base64,${data.frame}`,
              timestamp: new Date(data.timestamp).toISOString(),
              frameNumber: data.frameNumber,
              size: data.size,
              status: "online",
            };

            // Update camera data
            setCameras((prev) => {
              const existing = prev.find((cam) => cam.id === data.clientId);
              if (existing) {
                return prev.map((cam) =>
                  cam.id === data.clientId ? cameraData : cam
                );
              } else {
                return [...prev, cameraData];
              }
            });

            // Update frame stats
            updateFrameStats(data.clientId);
            setLastUpdate(new Date());
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      wsRef.current.onclose = () => {
        console.log("Streaming connection closed");

        // Attempt to reconnect after 2 seconds
        if (isStreaming) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, 2000);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        setError("Connection to streaming server failed");
      };
    } catch (error) {
      console.error("Failed to connect to streaming server:", error);
      setError("Failed to connect to streaming server");
    }
  }, [isStreaming, updateFrameStats]);

  // Fallback HTTP API fetch
  const fetchCameras = useCallback(async () => {
    try {
      // Try the new live endpoint first (from memory cache)
      let response;
      try {
        response = await fetch("http://localhost:3001/api/cameras/live");
        const data = await response.json();

        if (data.success && data.cached) {
          setCameras(
            data.cameras.map((camera: any) => ({
              ...camera,
              status: camera.status === "online" ? "online" : "offline",
            }))
          );
          setError(null);
          setLastUpdate(new Date());
          return;
        }
      } catch (liveError) {
        console.log("Live endpoint unavailable, falling back to standard API");
      }

      // Fallback to standard API
      response = await api.api.cameras.all.get();

      if (response.data?.success) {
        setCameras(
          response.data.cameras.map((camera: any) => ({
            ...camera,
            status: camera.status === "online" ? "online" : "offline",
          }))
        );
        setError(null);
        setLastUpdate(new Date());
      } else {
        setError(response.data?.error || "Failed to fetch cameras");
      }
    } catch (err) {
      setError("Network error: Could not connect to server");
      console.error("Failed to fetch cameras:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

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
      }

      return newStreaming;
    });
  }, [connectWebSocket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
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
