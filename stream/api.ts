import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { ImageHandler } from "./imageHandler.js";

const imageHandler = new ImageHandler();

const api = new Elysia({ prefix: "/api" })
  .use(cors())
  .get("/cameras", async () => {
    try {
      const clients = await imageHandler.getAllClients();
      return {
        success: true,
        cameras: clients,
        count: clients.length
      };
    } catch (error) {
      return {
        success: false,
        error: "Failed to fetch cameras",
        cameras: [],
        count: 0
      };
    }
  })
  .get("/camera/:id", async ({ params: { id } }) => {
    try {
      const imageData = await imageHandler.getClientImage(id);
      if (!imageData) {
        return {
          success: false,
          error: "Camera not found or no image available"
        };
      }
      
      return {
        success: true,
        camera: {
          id: imageData.clientId,
          image: `data:image/jpeg;base64,${imageData.data}`,
          timestamp: imageData.timestamp,
          frameNumber: imageData.frame_number,
          size: imageData.size
        }
      };
    } catch (error) {
      return {
        success: false,
        error: "Failed to fetch camera image"
      };
    }
  })
  .get("/cameras/all", async () => {
    try {
      const clients = await imageHandler.getAllClients();
      const cameraData = await Promise.all(
        clients.map(async (clientId) => {
          const imageData = await imageHandler.getClientImage(clientId);
          if (!imageData) {
            return {
              id: clientId,
              image: null,
              timestamp: null,
              frameNumber: 0,
              size: 0,
              status: "offline"
            };
          }
          
          return {
            id: imageData.clientId,
            image: `data:image/jpeg;base64,${imageData.data}`,
            timestamp: imageData.timestamp,
            frameNumber: imageData.frame_number,
            size: imageData.size,
            status: "online"
          };
        })
      );
      
      return {
        success: true,
        cameras: cameraData,
        count: cameraData.length
      };
    } catch (error) {
      return {
        success: false,
        error: "Failed to fetch all cameras",
        cameras: [],
        count: 0
      };
    }
  })
  .get("/stats", async () => {
    try {
      const stats = imageHandler.getStats();
      const clientStats = await imageHandler.getClientStats();
      
      return {
        success: true,
        stats: {
          ...stats,
          ...clientStats
        }
      };
    } catch (error) {
      return {
        success: false,
        error: "Failed to fetch stats"
      };
    }
  });

// Export the API type for Eden
export type API = typeof api;
export { api };