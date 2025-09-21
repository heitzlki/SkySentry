"use client";

import { useEffect, useState, useRef } from "react";
import { CameraGrid } from "@/components/camera-grid";
import { client } from "@/lib/api-client";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const FADE_TIME = 5000; // 5 seconds

const getColorForGid = (gid: number) => {
  const hue = (gid * 137.5) % 360;
  return `hsl(${hue}, 70%, 70%)`;
};

export default function StreamingPage() {
  const [aiProcessData, setAiProcessData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedFrame = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailsRef = useRef(
    new Map<number, Array<{ x: number; y: number; timestamp: number }>>()
  );
  const previousDataRef = useRef<any>(null);

  const fetchAiProcess = async () => {
    console.info("Fetching AI process data...");
    try {
      const response = await client.ai.process({ id: "demo" }).get();
      setAiProcessData(response.data);
    } catch (err) {
      setError("Error fetching AI process data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAiProcess(); // Initial fetch
  }, []);

  const handleFrameUpdate = (clientId: string, data: any) => {
    const frameCount = data.stats?.frameCount || 0;
    if (frameCount >= lastFetchedFrame.current + 5) {
      fetchAiProcess();
      lastFetchedFrame.current = frameCount;
    }
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const currentTime = Date.now();

    // Fade background
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw grid
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= CANVAS_WIDTH; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= CANVAS_HEIGHT; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // Find bounds
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    trailsRef.current.forEach((trail) => {
      trail.forEach((p) => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      });
    });

    if (minX === Infinity) return; // no data

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const scaleX = CANVAS_WIDTH / rangeX;
    const scaleY = CANVAS_HEIGHT / rangeY;
    const offsetX = -minX * scaleX;
    const offsetY = -minY * scaleY;

    // Draw trails
    trailsRef.current.forEach((trail, gid) => {
      const hue = (gid * 137.5) % 360;
      const sortedTrail = trail
        .slice()
        .sort((a, b) => a.timestamp - b.timestamp);

      // Draw lines
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < sortedTrail.length; i++) {
        const p = sortedTrail[i];
        const age = currentTime - p.timestamp;
        const opacity = Math.max(0, 1 - age / FADE_TIME);
        if (opacity <= 0) continue;

        const px = p.x * scaleX + offsetX;
        const py = CANVAS_HEIGHT - (p.y * scaleY + offsetY);

        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
        ctx.strokeStyle = `hsl(${hue}, 70%, 70%, ${opacity})`;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px, py);
      }

      // Draw points
      sortedTrail.forEach((p) => {
        const age = currentTime - p.timestamp;
        const opacity = Math.max(0, 1 - age / FADE_TIME);
        if (opacity <= 0) return;

        const px = p.x * scaleX + offsetX;
        const py = CANVAS_HEIGHT - (p.y * scaleY + offsetY);

        ctx.fillStyle = `hsl(${hue}, 70%, 70%, ${opacity})`;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, 2 * Math.PI);
        ctx.fill();
      });
    });
  };

  useEffect(() => {
    if (!aiProcessData || !Array.isArray(aiProcessData)) return;

    const currentTime = Date.now();
    const newTrails = new Map(trailsRef.current);

    aiProcessData.forEach((det: any) => {
      const gid = det.global_id;
      if (!gid || det.Xw == null || det.Yw == null) return;

      if (!newTrails.has(gid)) newTrails.set(gid, []);
      const trail = newTrails.get(gid)!;

      // Find previous position
      const prev = previousDataRef.current?.find(
        (p: any) => p.global_id === gid
      );
      if (prev && prev.Xw != null && prev.Yw != null) {
        // Interpolate
        const steps = 10;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const ix = prev.Xw + t * (det.Xw - prev.Xw);
          const iy = prev.Yw + t * (det.Yw - prev.Yw);
          trail.push({ x: ix, y: iy, timestamp: currentTime });
        }
      }

      // Add current position
      trail.push({ x: det.Xw, y: det.Yw, timestamp: currentTime });
    });

    trailsRef.current = newTrails;
    previousDataRef.current = aiProcessData;
    drawCanvas();
  }, [aiProcessData]);

  return (
    <div className="container mx-auto py-8 pt-20">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">SkySentry Stream</h1>
        <p className="text-muted-foreground">
          Real-time camera feeds from all connected devices
        </p>
      </div>
      <div className="grid grid-cols-3">
        <div className="col-span-1">
          <CameraGrid
            aiProcessData={aiProcessData}
            onFrameUpdate={handleFrameUpdate}
          />
        </div>
        <div className="col-span-2">
          {loading && <p>Loading AI process data...</p>}
          {error && <p className="text-red-500">Error: {error}</p>}
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="border border-gray-300 bg-black"
          />
        </div>
      </div>
    </div>
  );
}
