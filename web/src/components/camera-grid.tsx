"use client";

import { useState, useEffect, useRef } from "react";

interface CameraData {
  image: string;
  timestamp: Date;
  fps: number;
  size: number;
  frameCount: number;
}

export function CameraGrid() {
  const [cameras, setCameras] = useState<Record<string, CameraData>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const timestampsRef = useRef<Record<string, number[]>>({});

  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket("ws://localhost:8080/stream/ws");
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Connected to streaming WebSocket");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "frame_update") {
            const { clientId, image, timestamp, size, stats } = data;
            const now = Date.now();
            const ts = new Date(timestamp);

            // Update timestamps for FPS calculation
            if (!timestampsRef.current[clientId]) {
              timestampsRef.current[clientId] = [];
            }
            timestampsRef.current[clientId].push(now);
            // Keep only last 10 timestamps
            if (timestampsRef.current[clientId].length > 10) {
              timestampsRef.current[clientId].shift();
            }

            // Calculate FPS
            const tsList = timestampsRef.current[clientId];
            let fps = 0;
            if (tsList.length > 1) {
              const intervals = [];
              for (let i = 1; i < tsList.length; i++) {
                intervals.push(tsList[i] - tsList[i - 1]);
              }
              const avgInterval =
                intervals.reduce((a, b) => a + b, 0) / intervals.length;
              fps = Math.round(1000 / avgInterval);
            }

            setCameras((prev) => ({
              ...prev,
              [clientId]: {
                image,
                timestamp: ts,
                fps,
                size,
                frameCount: stats?.frameCount || 0,
              },
            }));
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket closed, reconnecting...");
        setTimeout(connectWebSocket, 1000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const cameraEntries = Object.entries(cameras);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
      {cameraEntries.length === 0 ? (
        <div className="col-span-full text-center text-muted-foreground">
          No cameras connected. Waiting for streams...
        </div>
      ) : (
        cameraEntries.map(([clientId, data]) => (
          <div
            key={clientId}
            className="border rounded-lg overflow-hidden bg-card"
          >
            <div className="p-2 bg-muted/50 flex justify-between items-center">
              <span className="font-medium text-sm">{clientId}</span>
              <span className="text-xs text-muted-foreground">
                {data.fps} FPS | {Math.round(data.size / 1024)}KB
              </span>
            </div>
            <div className="relative aspect-video bg-black">
              <img
                src={data.image}
                alt={`Camera ${clientId}`}
                className="w-full h-full object-contain"
                loading="lazy"
              />
            </div>
            <div className="p-2 text-xs text-muted-foreground">
              Frame: {data.frameCount} | {data.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
