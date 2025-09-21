"use client";

import { treaty } from "@elysiajs/eden";
import { useEffect, useState } from "react";
import { App } from "../../../../brain/src";

const client = treaty<App>("http://localhost:4000");

export default function StreamPage() {
  const [detections, setDetections] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { data, error } = await client.detections.latest.get();

        if (error) {
          throw error;
        }

        setDetections(data);
        setError(null);
      } catch (e: any) {
        setError(e.message);
        console.error(e);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Live Detections</h1>
      {error && <p className="text-red-500">Error: {error}</p>}
      <pre className="bg-gray-100 p-4 rounded-md overflow-auto text-sm dark:bg-gray-800">
        {JSON.stringify(detections, null, 2)}
      </pre>
    </div>
  );
}
