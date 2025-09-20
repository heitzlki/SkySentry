import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { createClient, type RedisClientType } from "redis";

// Redis client setup
class RedisService {
  private client: RedisClientType;
  private isConnected = false;

  constructor() {
    this.client = createClient({
      url: "redis://localhost:6379",
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
      },
    });

    this.client.on("error", (err) => {
      this.isConnected = false;
      console.error("Redis error:", err.message);
    });

    this.client.on("connect", () => {
      this.isConnected = true;
      console.log("✅ Redis connected");
    });

    this.connect();
  }

  private async connect() {
    try {
      await this.client.connect();
    } catch (error) {
      console.error("Failed to connect to Redis:", error);
    }
  }

  async getAllClients(): Promise<string[]> {
    if (!this.isConnected) return [];
    try {
      return await this.client.sMembers("clients");
    } catch (error) {
      console.error("Error getting clients:", error);
      return [];
    }
  }

  async getImageForClient(clientId: string): Promise<any | null> {
    if (!this.isConnected) return null;
    try {
      const imageData = await this.client.hGetAll(`image:${clientId}`);
      if (Object.keys(imageData).length === 0) return null;

      return {
        clientId,
        data: imageData.data,
        size: parseInt(imageData.size || "0"),
        format: imageData.format,
        timestamp: imageData.timestamp,
        frame_number: parseInt(imageData.frame_number || "0"),
      };
    } catch (error) {
      console.error(`Error getting image for client ${clientId}:`, error);
      return null;
    }
  }

  async getAllClientImages(): Promise<Record<string, any>> {
    const clients = await this.getAllClients();
    const result: Record<string, any> = {};

    for (const clientId of clients) {
      const image = await this.getImageForClient(clientId);
      if (image) {
        result[clientId] = image;
      }
    }

    return result;
  }
}

// Initialize Redis service
const redisService = new RedisService();

// Define response schemas for documentation
const ClientImageSchema = t.Object({
  clientId: t.String(),
  data: t.String({ description: "Base64 encoded image data" }),
  size: t.Number({ description: "Image size in bytes" }),
  format: t.String({ description: "Image format (e.g., 'jpeg', 'png')" }),
  timestamp: t.String({ description: "ISO timestamp when image was captured" }),
  frame_number: t.Number({ description: "Frame sequence number" }),
});

const app = new Elysia()
  .use(
    swagger({
      documentation: {
        info: {
          title: "SkySentry Backend API",
          version: "1.0.0",
          description:
            "API for managing WebRTC clients and their captured images stored in Redis",
        },
        servers: [
          {
            url: "http://localhost:5000",
            description: "Development server",
          },
        ],
        tags: [
          {
            name: "clients",
            description: "Client management endpoints",
          },
          {
            name: "images",
            description: "Image data endpoints",
          },
        ],
      },
    })
  )
  .get("/", () => "SkySentry Backend API - Visit /swagger for documentation")

  // 1. Get all current clients (returns list of IDs from Redis)
  .get(
    "/clients",
    async () => {
      const clients = await redisService.getAllClients();
      return {
        success: true,
        count: clients.length,
        clients,
      };
    },
    {
      detail: {
        tags: ["clients"],
        summary: "Get all active client IDs",
        description:
          "Returns a list of all currently active client IDs stored in Redis",
      },
      response: t.Object({
        success: t.Boolean(),
        count: t.Number(),
        clients: t.Array(t.String()),
      }),
    }
  )

  // 2. Get image for a given ID
  .get(
    "/clients/:id/image",
    async ({ params: { id }, set }) => {
      const image = await redisService.getImageForClient(id);

      if (!image) {
        set.status = 404;
        return {
          success: false,
          message: `No image found for client: ${id}`,
        };
      }

      return {
        success: true,
        image,
      };
    },
    {
      detail: {
        tags: ["images"],
        summary: "Get image for specific client",
        description:
          "Returns the latest captured image for a specific client ID",
      },
      params: t.Object({
        id: t.String({ description: "Client ID" }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          image: ClientImageSchema,
        }),
        404: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    }
  )

  // 3. Return all id:images as a JSON pair
  .get(
    "/images",
    async () => {
      const images = await redisService.getAllClientImages();
      return {
        success: true,
        count: Object.keys(images).length,
        images,
      };
    },
    {
      detail: {
        tags: ["images"],
        summary: "Get all client images",
        description:
          "Returns all client IDs paired with their latest captured images as a JSON object",
      },
      response: t.Object({
        success: t.Boolean(),
        count: t.Number(),
        images: t.Record(t.String(), ClientImageSchema),
      }),
    }
  )

  .listen(5000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
console.log(`📚 API Documentation available at http://localhost:5000/swagger`);
