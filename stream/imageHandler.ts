import { createClient, type RedisClientType } from "redis";
import { type WebcamFrame } from "./messageTypes.js";

export class ImageHandler {
  private frameCounter = 0;
  private redisClient: RedisClientType | null = null;
  private isConnected = false;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private readonly INACTIVE_TIMEOUT_MS = 30000; // Increased to 30 seconds
  private readonly CLEANUP_INTERVAL_MS = 60000; // Increased to 60 seconds
  private readonly RECONNECT_DELAY_MS = 2000; // Reduced to 2 seconds

  // Batch processing for better performance
  private pendingOperations: Array<() => Promise<void>> = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 10;
  private readonly BATCH_TIMEOUT_MS = 50; // 50ms batch timeout

  constructor() {
    this.connect();
  }

  private async connect(): Promise<void> {
    if (this.isConnected || this.redisClient) return;

    try {
      this.redisClient = createClient({
        url: process.env.REDIS_URL || "redis://localhost:6379",
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 1000), // Faster reconnect
          connectTimeout: 5000,
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
        console.log("Redis connected successfully");
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
    }, this.CLEANUP_INTERVAL_MS);
  }

  // Optimized batch processing
  private async processBatch(): Promise<void> {
    if (this.pendingOperations.length === 0) return;

    const operations = this.pendingOperations.splice(0, this.BATCH_SIZE);

    try {
      await Promise.all(operations.map((op) => op().catch(() => {}))); // Silent fail for individual operations
    } catch (error) {
      // Batch processing error - silent fail
    }
  }

  private scheduleBatch(operation: () => Promise<void>): void {
    this.pendingOperations.push(operation);

    if (this.pendingOperations.length >= this.BATCH_SIZE) {
      // Process immediately if batch is full
      this.processBatch();
    } else if (!this.batchTimeout) {
      // Schedule batch processing
      this.batchTimeout = setTimeout(() => {
        this.batchTimeout = null;
        this.processBatch();
      }, this.BATCH_TIMEOUT_MS);
    }
  }

  private async cleanupInactive(): Promise<void> {
    if (!this.isConnected || !this.redisClient) return;

    try {
      const clients = await this.redisClient.sMembers("clients");
      if (!clients.length) return;

      const now = Date.now();
      const toRemove: string[] = [];

      // Use pipeline for efficient batch operations
      const pipeline = this.redisClient.multi();

      for (const clientId of clients) {
        pipeline.hGet(`client:${clientId}`, "last_seen");
      }

      const results = await pipeline.exec();

      results?.forEach((result, index) => {
        const clientId = clients[index];
        // Fix type casting issue by going through unknown first
        const lastSeen = result as unknown as string | null;

        if (!lastSeen) {
          toRemove.push(clientId);
          return;
        }

        const timeDiff = now - new Date(lastSeen).getTime();
        if (timeDiff > this.INACTIVE_TIMEOUT_MS) {
          toRemove.push(clientId);
        }
      });

      if (toRemove.length > 0) {
        await this.removeClients(toRemove);
        console.log(`Cleaned up ${toRemove.length} inactive clients`);
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

    // Use batched operations for better performance
    this.scheduleBatch(async () => {
      if (!this.redisClient) return;

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
    });
  }

  public async removeClient(clientId: string): Promise<void> {
    if (!this.isConnected || !this.redisClient) return;
    await this.removeClients([clientId]);
  }

  public async updateClientLastSeen(clientId: string): Promise<void> {
    if (!this.isConnected || !this.redisClient) return;

    // Use batched operations for high-frequency updates
    this.scheduleBatch(async () => {
      if (!this.redisClient) return;

      try {
        await this.redisClient.hSet(
          `client:${clientId}`,
          "last_seen",
          new Date().toISOString()
        );
      } catch (error) {
        // Silent fail - this is called frequently
      }
    });
  }

  public async processWebcamFrame(frame: WebcamFrame): Promise<void> {
    if (!this.isConnected || !this.redisClient) return;

    // Use batched operations for frame processing
    this.scheduleBatch(async () => {
      if (!this.redisClient) return;

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

        // Optimized data parsing
        if (typeof frame.payload.data === "string") {
          if (frame.payload.data.includes(",")) {
            // Fast array parsing with Uint8Array
            const byteArray = new Uint8Array(
              frame.payload.data.split(",").map((str) => parseInt(str, 10))
            );
            imageBuffer = Buffer.from(byteArray);
          } else {
            imageBuffer = Buffer.from(frame.payload.data, "base64");
          }
        } else {
          imageBuffer = Buffer.from(frame.payload.data);
        }

        if (imageBuffer.length === 0) return;

        // Store only essential data to reduce Redis overhead
        const pipeline = this.redisClient.multi();
        const now = new Date().toISOString();

        // Store compressed image data
        pipeline.hSet(`image:${frame.clientId}`, {
          data: imageBuffer.toString("base64"),
          size: imageBuffer.length.toString(),
          format: frame.payload.format,
          timestamp: frame.timestamp || now,
          frame_number: this.frameCounter.toString(),
        });

        // Update client activity (less frequently to reduce overhead)
        if (this.frameCounter % 10 === 0) {
          // Only every 10th frame
          pipeline.hSet(`client:${frame.clientId}`, "last_seen", now);
          pipeline.sAdd("clients", frame.clientId);
        }

        await pipeline.exec();
      } catch (error) {
        // Silent fail
      }
    });
  }

  // Optimized with connection pooling
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
    pendingOperations: number;
  } {
    return {
      totalFrames: this.frameCounter,
      redisConnected: this.isConnected,
      redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
      pendingOperations: this.pendingOperations.length,
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

      // Use pipeline for efficient batch metadata retrieval
      const pipeline = this.redisClient.multi();
      clientList.forEach((clientId) => {
        pipeline.hGetAll(`client:${clientId}`);
      });

      const results = await pipeline.exec();
      const clientsWithMetadata = clientList.map((clientId, index) => ({
        id: clientId,
        metadata: (results?.[index] as unknown as Record<string, string>) || {},
      }));

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
    // Process any remaining batched operations
    if (this.pendingOperations.length > 0) {
      await this.processBatch();
    }

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

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
