"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Pause, RefreshCw, Camera, AlertCircle } from "lucide-react";
import { api, type CameraData } from "@/lib/api-client";

export function CameraGrid() {
  const [cameras, setCameras] = useState<CameraData[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchCameras = useCallback(async () => {
    try {
      const response = await api.api.cameras.all.get();

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

  useEffect(() => {
    // Initial fetch
    fetchCameras();
  }, [fetchCameras]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isStreaming) {
      // Fetch at 10 FPS (100ms intervals)
      interval = setInterval(fetchCameras, 100);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStreaming, fetchCameras]);

  const toggleStreaming = () => {
    setIsStreaming(!isStreaming);
  };

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
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <Button
            onClick={toggleStreaming}
            variant={isStreaming ? "destructive" : "default"}
            size="sm"
          >
            {isStreaming ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
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

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Camera Grid */}
      {cameras.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Cameras Found</h3>
              <p className="text-muted-foreground">
                Connect some cameras to start streaming
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cameras.map((camera) => (
            <CameraCard
              key={camera.id}
              camera={camera}
              isStreaming={isStreaming}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CameraCardProps {
  camera: CameraData;
  isStreaming: boolean;
}

function CameraCard({ camera, isStreaming }: CameraCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium truncate">
            {camera.id}
          </CardTitle>
          <Badge
            variant={camera.status === "online" ? "default" : "secondary"}
            className="ml-2"
          >
            {camera.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="aspect-video bg-black relative">
          {camera.image ? (
            <img
              src={camera.image}
              alt={`Camera ${camera.id}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <Camera className="h-8 w-8 mx-auto mb-2" />
                <span className="text-xs">No Image</span>
              </div>
            </div>
          )}

          {/* Streaming indicator */}
          {isStreaming && camera.status === "online" && (
            <div className="absolute top-2 right-2">
              <div className="flex items-center space-x-1 bg-red-600 text-white px-2 py-1 rounded text-xs">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span>LIVE</span>
              </div>
            </div>
          )}
        </div>

        {/* Camera info */}
        <div className="p-3 bg-muted/30">
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
      </CardContent>
    </Card>
  );
}
