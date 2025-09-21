"use client";

import { useEffect, useState, useRef } from "react";
import { CameraGrid } from "@/components/camera-grid";
import { client } from "@/lib/api-client";

export default function StreamingPage() {
  const [aiProcessData, setAiProcessData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedFrame = useRef(0);

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
    if (frameCount >= lastFetchedFrame.current + 25) {
      fetchAiProcess();
      lastFetchedFrame.current = frameCount;
    }
  };

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
          {aiProcessData && (
            <pre className=" p-4 rounded overflow-auto">
              {JSON.stringify(aiProcessData, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
