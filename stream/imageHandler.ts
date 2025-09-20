import { createClient, type RedisClientType } from "redis";
import { type WebcamFrame } from "./messageTypes.js";

export class ImageHandler {
  private frameCounter = 0;
  private redisClient: RedisClientType | null = null;
  private isConnected = false;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private readonly INACTIVE_TIMEOUT_MS = 5000; // 5 seconds
  private readonly CLEANUP_INTERVAL_MS = 10000; // 10 seconds
  private readonly RECONNECT_DELAY_MS = 5000; // 5 seconds

  constructor() {
    this.connect();
  }

  private async connect(): Promise<void> {
    if (this.isConnected || this.redisClient) return;

    try {
      this.redisClient = createClient({
        url: process.env.REDIS_URL || "redis://localhost:6379",
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
        },
      });

      this.redisClient.on("error", (err) => {
        this.isConnected = false;
        if (err.code !== "ECONNREFUSED") {
          console.error("Redis error:", err.message);
        }
        this.scheduleReconnect();
      });

      this.redisClient.on("connect", () => {
        this.isConnected = true;
        this.startCleanup();
      });

      this.redisClient.on("end", () => {
        this.isConnected = false;
      });

      await this.redisClient.connect();
    } catch (error) {
      this.isConnected = false;
      this.redisClient = null;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, this.RECONNECT_DELAY_MS);
  }

  private startCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(async () => {
      await this.cleanupInactive();
      console.info("ImageHandler cleanup completed");
    }, this.CLEANUP_INTERVAL_MS);
  }

  private async cleanupInactive(): Promise<void> {
    if (!this.isConnected || !this.redisClient) return;

    try {
      const clients = await this.redisClient.sMembers("clients");
      if (!clients.length) return;

      const now = Date.now();
      const toRemove: string[] = [];

      for (const clientId of clients) {
        const lastSeen = await this.redisClient.hGet(
          `client:${clientId}`,
          "last_seen"
        );
        if (!lastSeen) {
          toRemove.push(clientId);
          continue;
        }

        const timeDiff = now - new Date(lastSeen).getTime();
        if (timeDiff > this.INACTIVE_TIMEOUT_MS) {
          toRemove.push(clientId);
        }
      }

      if (toRemove.length > 0) {
        await this.removeClients(toRemove);
      }
    } catch (error) {
      // Silent fail - cleanup will retry next interval
    }
  }

  private async removeClients(clientIds: string[]): Promise<void> {
    if (!this.isConnected || !this.redisClient) return;

    try {
      // Use pipeline for atomic operations
      const pipeline = this.redisClient.multi();

      for (const clientId of clientIds) {
        pipeline.sRem("clients", clientId);
        pipeline.del(`client:${clientId}`);
        pipeline.del(`image:${clientId}`);
      }

      await pipeline.exec();
    } catch (error) {
      // Silent fail
    }
  }

  public async addClient(clientId: string): Promise<void> {
    if (!this.isConnected || !this.redisClient) return;

    try {
      const now = new Date().toISOString();
      const pipeline = this.redisClient.multi();

      pipeline.sAdd("clients", clientId);
      pipeline.hSet(`client:${clientId}`, {
        connected_at: now,
        last_seen: now,
        status: "connected",
      });

      await pipeline.exec();
    } catch (error) {
      // Silent fail
    }
  }

  public async removeClient(clientId: string): Promise<void> {
    if (!this.isConnected || !this.redisClient) return;
    await this.removeClients([clientId]);
  }

  public async updateClientLastSeen(clientId: string): Promise<void> {
    if (!this.isConnected || !this.redisClient) return;

    try {
      await this.redisClient.hSet(
        `client:${clientId}`,
        "last_seen",
        new Date().toISOString()
      );
    } catch (error) {
      // Silent fail - this is called frequently
    }
  }

  public async processWebcamFrame(frame: WebcamFrame): Promise<void> {
    if (!this.isConnected || !this.redisClient) return;

    try {
      this.frameCounter++;

      // Skip placeholder data
      if (
        frame.payload.format === "binary" &&
        frame.payload.data === "binary_data_placeholder"
      ) {
        return;
      }

      let imageBuffer: Buffer;

      // Handle different data formats
      if (frame.payload.data.includes(",")) {
        // Array format from frontend
        const byteArray = frame.payload.data
          .split(",")
          .map((str) => parseInt(str.trim(), 10));
        imageBuffer = Buffer.from(byteArray);
      } else {
        // Base64 format
        imageBuffer = Buffer.from(frame.payload.data, "base64");
      }

      if (imageBuffer.length === 0) return;

      // Store image and update client activity atomically
      const pipeline = this.redisClient.multi();
      const now = new Date().toISOString();

      pipeline.hSet(`image:${frame.clientId}`, {
        data: imageBuffer.toString("base64"),
        size: imageBuffer.length.toString(),
        format: frame.payload.format,
        timestamp: frame.timestamp || now,
        frame_number: this.frameCounter.toString(),
      });

      pipeline.hSet(`client:${frame.clientId}`, "last_seen", now);

      // also ensure client is in the clients set
      pipeline.sAdd("clients", frame.clientId);

      console.info(
        `Stored frame ${this.frameCounter} for client ${frame.clientId}, size: ${imageBuffer.length} bytes`
      );
      await pipeline.exec();
    } catch (error) {
      // Silent fail
    }
  }

  public async getClientImage(clientId: string): Promise<any | null> {
    if (!this.isConnected || !this.redisClient) return null;

    try {
      const imageData = await this.redisClient.hGetAll(`image:${clientId}`);
      if (Object.keys(imageData).length === 0) return null;

      return {
        clientId,
        ...imageData,
        size: parseInt(imageData.size || "0"),
        frame_number: parseInt(imageData.frame_number || "0"),
      };
    } catch (error) {
      return null;
    }
  }

  public async getAllClients(): Promise<string[]> {
    if (!this.isConnected || !this.redisClient) return [];

    try {
      return await this.redisClient.sMembers("clients");
    } catch (error) {
      return [];
    }
  }

  public async getClientMetadata(clientId: string): Promise<any | null> {
    if (!this.isConnected || !this.redisClient) return null;

    try {
      const metadata = await this.redisClient.hGetAll(`client:${clientId}`);
      return Object.keys(metadata).length > 0 ? metadata : null;
    } catch (error) {
      return null;
    }
  }

  public getStats(): {
    totalFrames: number;
    redisConnected: boolean;
    redisUrl: string;
  } {
    return {
      totalFrames: this.frameCounter,
      redisConnected: this.isConnected,
      redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
    };
  }

  public async getClientStats(): Promise<{
    totalClients: number;
    clientList: string[];
    clientsWithMetadata: Array<{ id: string; metadata: any }>;
  }> {
    if (!this.isConnected || !this.redisClient) {
      return { totalClients: 0, clientList: [], clientsWithMetadata: [] };
    }

    try {
      const clientList = await this.getAllClients();
      const clientsWithMetadata = [];

      for (const clientId of clientList) {
        const metadata = await this.getClientMetadata(clientId);
        clientsWithMetadata.push({ id: clientId, metadata });
      }

      return {
        totalClients: clientList.length,
        clientList,
        clientsWithMetadata,
      };
    } catch (error) {
      return { totalClients: 0, clientList: [], clientsWithMetadata: [] };
    }
  }

  public resetStats(): void {
    this.frameCounter = 0;
  }

  public async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch (error) {
        // Ignore quit errors
      }
      this.redisClient = null;
    }

    this.isConnected = false;
  }
}
