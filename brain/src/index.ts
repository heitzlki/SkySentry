import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import { detectionService } from "./db/detection-service";
import { DetectionObjectSchema } from "./types";
import { DetectionObject } from "./types";

const buffer: Map<number, DetectionObject[]> = new Map();
const lastSeen: Map<number, number> = new Map(); // Track when objects were last seen
const FRAME_RATE = 30;
const BUFFER_SECONDS = 5;
const MAX_FRAMES = FRAME_RATE * BUFFER_SECONDS;
const PERSISTENCE_FRAMES = 60; // Keep objects for 2 seconds after last detection
const CLEANUP_FRAMES = 300; // Remove objects after 10 seconds of no detection

// Export all types and functions for camera data
export * from "./types";
export * from "./fetch";

const app = new Elysia()
  .use(
    cors({
      origin: true, // Allow all origins
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      credentials: true,
    })
  )
  .use(
    swagger({
      documentation: {
        info: {
          title: "SkySentry Brain API",
          version: "1.0.0",
          description: "API documentation for SkySentry Brain service",
        },
        tags: [
          { name: "cameras", description: "Camera endpoints" },
          { name: "detections", description: "Detection data endpoints" },
          { name: "health", description: "Health check endpoints" },
        ],
      },
    })
  )
  .get("/", () => "Hello Elysia", {
    tags: ["health"],
  })
  .get(
    "/detections",
    async ({ query }) => {
      try {
        const { limit } = query;
        const detections = await detectionService.getAllDetections();
        const count = await detectionService.getDetectionCount();

        return {
          success: true,
          detections: limit ? detections.slice(0, parseInt(limit)) : detections,
          count,
          cameraId: "demo",
        };
      } catch (error) {
        console.error("Error in /detections endpoint:", error);
        return {
          success: false,
          detections: [],
          count: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      tags: ["detections"],
      detail: {
        summary: "Get all detection data for the demo camera",
        description:
          "Retrieve stored detection objects from the database for the demo camera",
      },
    }
  )
  .get(
    "/detections/latest",
    async ({ query }) => {
      try {
        const { limit = "10" } = query;

        const cameraId = "demo";

        const detections = await detectionService.getLatestDetections(
          cameraId,
          parseInt(limit)
        );

        return {
          success: true,
          detections,
          count: detections.length,
          cameraId,
        };
      } catch (error) {
        console.error("Error in /detections/latest endpoint:", error);
        return {
          success: false,
          detections: [],
          count: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      tags: ["detections"],
      detail: {
        summary: "Get latest detections for the demo camera",
        description:
          "Retrieve the most recent detection objects for the demo camera",
      },
    }
  )
  .get(
    "/cameras",
    async () => {
      const backendUrl =
        process.env.BACKEND_API_URL || "https://demo8080.shivi.io/api";

      try {
        const cameraId = "demo";

        const frameResponse = await fetch(
          `${backendUrl}/clients/${cameraId}/latest`
        );
        const frameData = await frameResponse.json();

        const camera = {
          id: cameraId,
          image: frameData.success ? frameData.image : null,
          timestamp: frameData.success ? frameData.timestamp : null,
          frameNumber: frameData.success ? frameData.stats?.frameCount || 0 : 0,
          size: frameData.success ? frameData.size || 0 : 0,
          status: frameData.success ? "online" : "offline",
        };

        return {
          success: true,
          cameras: [camera],
          count: 1,
        };
      } catch (error) {
        console.error("Error in /cameras endpoint:", error);
        return {
          success: false,
          cameras: [],
          count: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      tags: ["cameras"],
      detail: {
        summary: "Get the demo camera",
        description:
          "Retrieve the demo camera with its latest frame from the backend service.",
      },
    }
  )
  .get(
    "/cameras/stats",
    async () => {
      const backendUrl =
        process.env.BACKEND_API_URL || "https://demo8080.shivi.io/api";
      try {
        const response = await fetch(`${backendUrl}/stats`);
        if (!response.ok) {
          throw new Error(`Failed to fetch camera stats: ${response.status}`);
        }
        const data = await response.json();
        return {
          success: true,
          stats: data,
        };
      } catch (error) {
        console.error("Error in /cameras/stats endpoint:", error);
        return {
          success: false,
          stats: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      tags: ["cameras"],
      detail: {
        summary: "Get camera statistics",
        description: "Retrieve camera statistics from the backend service.",
      },
    }
  )
  .get(
    "/clients",
    async () => {
      return {
        success: true,
        clients: ["demo"],
        count: 1,
      };
    },
    {
      tags: ["cameras"],
      detail: {
        summary: "Get all clients",
        description: "Return the demo client",
      },
    }
  )
  .get(
    "/ai/process/:id",
    async ({ params }) => {
      const { id } = params;
      const backendUrl = "http://localhost:8001";
      console.log("Running me");
      try {
        const response = await fetch(`${backendUrl}/ai/process/${id}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch AI process: ${response.status}`);
        }

        const data = await response.json();
        const detections: DetectionObject[] = data.detections || [];
        console.log("Received detections:", detections.length);

        // Get current frame number for tracking
        let currentFrame = 0;
        if (detections.length > 0) {
          currentFrame = Math.max(...detections.map((d) => d.frame ?? 0));
        } else {
          // If no detections, estimate current frame from existing buffer
          const allFrames = Array.from(buffer.values())
            .flat()
            .map((d) => d.frame ?? 0);
          currentFrame = allFrames.length > 0 ? Math.max(...allFrames) + 1 : 0;
        }

        // Update buffer and track currently detected objects
        const currentGroupIds = new Set<number>();
        for (const det of detections) {
          if (!det.global_id || det.frame === undefined) continue;
          currentGroupIds.add(det.global_id);

          if (!buffer.has(det.global_id)) {
            buffer.set(det.global_id, []);
          }
          const groupBuffer = buffer.get(det.global_id)!;
          groupBuffer.push(det);

          // Keep only recent frames
          const maxFrame = Math.max(...groupBuffer.map((d) => d.frame ?? 0));
          const minFrame = maxFrame - MAX_FRAMES;
          const filtered = groupBuffer.filter(
            (d) => (d.frame ?? 0) >= minFrame
          );
          buffer.set(det.global_id, filtered);
          lastSeen.set(det.global_id, det.frame); // Update last seen frame
        }

        console.log("Buffer groups:", buffer.size);
        console.log("Current active groups:", currentGroupIds.size);

        // Cleanup old objects that haven't been seen for too long
        const toDelete: number[] = [];
        for (const [groupId] of buffer) {
          if (!currentGroupIds.has(groupId)) {
            toDelete.push(groupId);
          }
        }

        for (const groupId of toDelete) {
          buffer.delete(groupId);
          lastSeen.delete(groupId);
          console.log(`Cleaned up object ${groupId} immediately`);
        }

        // Compute results - only include currently active objects
        const result: {
          x: number;
          y: number;
          dx: number;
          dy: number;
          label: string;
          firstSeenFrame: number;
          boundingBox: { x1: number; y1: number; x2: number; y2: number };
          global_id: number;
          isActive: boolean;
        }[] = [];

        for (const [groupId, groupDets] of buffer) {
          if (groupDets.length === 0) continue;

          // Only include currently detected objects
          const isActive = currentGroupIds.has(groupId);
          if (!isActive) continue;

          // Sort by frame
          groupDets.sort((a, b) => (a.frame ?? 0) - (b.frame ?? 0));
          const latest = groupDets[groupDets.length - 1];

          const x = latest.Xw ?? 0;
          const y = latest.Yw ?? 0;
          const label = latest.label ?? "unknown";
          const firstSeenFrame = groupDets[0].frame ?? 0;

          // Compute dx, dy from recent motion
          let dx = 0;
          let dy = 0;
          if (groupDets.length > 1) {
            const numPoints = Math.min(5, groupDets.length - 1);
            let sumDx = 0;
            let sumDy = 0;
            let validPoints = 0;

            for (
              let i = Math.max(0, groupDets.length - numPoints - 1);
              i < groupDets.length - 1;
              i++
            ) {
              const curr = groupDets[i + 1];
              const prev = groupDets[i];
              if (
                curr.Xw !== undefined &&
                prev.Xw !== undefined &&
                curr.Yw !== undefined &&
                prev.Yw !== undefined
              ) {
                sumDx += curr.Xw - prev.Xw;
                sumDy += curr.Yw - prev.Yw;
                validPoints++;
              }
            }

            if (validPoints > 0) {
              dx = sumDx / validPoints;
              dy = sumDy / validPoints;
            }
          }

          // Use bounding box from latest detection
          const boundingBox = {
            x1: latest.x1 ?? 0,
            y1: latest.y1 ?? 0,
            x2: latest.x2 ?? 0,
            y2: latest.y2 ?? 0,
          };

          result.push({
            x,
            y,
            dx,
            dy,
            label,
            firstSeenFrame,
            boundingBox,
            global_id: groupId,
            isActive,
          });
        }

        console.log("Result length:", result.length);
        return result;
      } catch (error) {
        console.error("Error in /ai/process/:id endpoint:", error);
        return [];
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      tags: ["ai"],
      detail: {
        summary: "Get AI processing result for a specific ID",
        description:
          "Retrieve AI processing detections from the backend service with Zod validation",
      },
    }
  )
  .listen(4000);

export type App = typeof app;

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
console.log(
  `📚 Swagger documentation available at: http://${app.server?.hostname}:${app.server?.port}/swagger`
);
console.log(`🗃️ In-memory SQLite database ready for detection data storage`);
