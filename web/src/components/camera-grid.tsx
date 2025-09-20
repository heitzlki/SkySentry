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
  const canvasRefs = useRef(new Map<string, HTMLCanvasElement>());
  const imgRef = useRef(new Image());

  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket("wss://demo8080.shivi.io/stream/ws");
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Connected to streaming WebSocket");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "frame_update") {
            const { clientId, image, timestamp, size, stats } = data;
            const ts = new Date(timestamp);

            setCameras((prev) => ({
              ...prev,
              [clientId]: {
                image,
                timestamp: ts,
                fps: stats?.fps || 0,
                size,
                frameCount: stats?.frameCount || 0,
              },
            }));

            // Update canvas directly for low latency
            const canvas = canvasRefs.current.get(clientId);
            if (canvas) {
              const img = imgRef.current;
              img.onload = () => {
                const ctx = canvas.getContext("2d");
                if (ctx) {
                  canvas.width = img.naturalWidth;
                  canvas.height = img.naturalHeight;
                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                  ctx.drawImage(img, 0, 0);
                }
              };
              img.src = image;
            }
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
                {data.fps.toFixed(1)} FPS | {Math.round(data.size / 1024)}KB
              </span>
            </div>
            <div className="relative aspect-video bg-black">
              <canvas
                ref={(el) => {
                  if (el) canvasRefs.current.set(clientId, el);
                }}
                className="w-full h-full object-contain"
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
