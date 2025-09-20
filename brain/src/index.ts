import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";

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
          { name: "health", description: "Health check endpoints" },
        ],
      },
    })
  )
  .get("/", () => "Hello Elysia", {
    tags: ["health"],
  })
  .get(
    "/cameras",
    async () => {
      const backendUrl =
        process.env.BACKEND_API_URL || "https://demo8080.shivi.io/api";

      try {
        // First get the list of clients
        const clientsResponse = await fetch(`${backendUrl}/clients`);

        if (!clientsResponse.ok) {
          throw new Error(`Failed to fetch clients: ${clientsResponse.status}`);
        }

        const clientsData = await clientsResponse.json();

        if (!clientsData.success) {
          throw new Error(
            `Backend error: ${clientsData.error || "Unknown error"}`
          );
        }

        // Transform clients into camera format
        const cameras = await Promise.all(
          clientsData.clients.map(async (clientId: string) => {
            try {
              // Get latest frame for each client
              const frameResponse = await fetch(
                `${backendUrl}/clients/${clientId}/latest`
              );
              const frameData = await frameResponse.json();

              return {
                id: clientId,
                image: frameData.success ? frameData.image : null,
                timestamp: frameData.success ? frameData.timestamp : null,
                frameNumber: frameData.success
                  ? frameData.stats?.frameCount || 0
                  : 0,
                size: frameData.success ? frameData.size || 0 : 0,
                status: frameData.success ? "online" : "offline",
              };
            } catch (error) {
              console.error(
                `Error fetching frame for client ${clientId}:`,
                error
              );
              return {
                id: clientId,
                image: null,
                timestamp: null,
                frameNumber: 0,
                size: 0,
                status: "offline",
              };
            }
          })
        );

        return {
          success: true,
          cameras,
          count: cameras.length,
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
        summary: "Get all cameras",
        description:
          "Retrieve all available cameras with their latest frames from the backend service",
      },
    }
  )
  .get(
    "/clients",
    async () => {
      const backendUrl =
        process.env.BACKEND_API_URL || "https://demo8080.shivi.io/api";

      try {
        const response = await fetch(`${backendUrl}/clients`);

        if (!response.ok) {
          throw new Error(`Failed to fetch clients: ${response.status}`);
        }

        return response.json();
      } catch (error) {
        console.error("Error in /clients endpoint:", error);
        return {
          success: false,
          clients: [],
          count: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      tags: ["cameras"],
      detail: {
        summary: "Get all clients",
        description: "Retrieve raw client list from the backend service",
      },
    }
  )
  .listen(4000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
console.log(
  `📚 Swagger documentation available at: http://${app.server?.hostname}:${app.server?.port}/swagger`
);
