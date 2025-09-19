import {
  type Message,
  MessageSchema,
  type MessageType,
} from "./messageTypes.js";

export type CustomMessageHandler = (message: Message) => void | Promise<void>;

export class BlackboxMessageHandler {
  private customHandler: CustomMessageHandler;
  private stats = {
    totalMessages: 0,
    messagesByType: {} as Record<MessageType, number>,
  };

  constructor(customHandler: CustomMessageHandler) {
    this.customHandler = customHandler;
    this.initializeStats();
  }

  private initializeStats() {
    const messageTypes: MessageType[] = [
      "text_message",
      "webcam_frame",
      "connection_status",
      "heartbeat",
      "error",
    ];

    messageTypes.forEach((type) => {
      this.stats.messagesByType[type] = 0;
    });
  }

  public async handleMessage(
    rawMessage: string | Buffer,
    clientId: string
  ): Promise<void> {
    try {
      // Parse the raw message
      let parsedData: any;

      if (Buffer.isBuffer(rawMessage)) {
        // Handle binary data (e.g., webcam frames)
        parsedData = {
          type: "webcam_frame",
          clientId,
          timestamp: new Date().toISOString(),
          payload: {
            data: rawMessage.toString("base64"),
            size: rawMessage.length,
            format: "binary",
          },
        };
      } else {
        // Parse JSON string
        parsedData = JSON.parse(rawMessage);

        // Ensure clientId and timestamp are set
        if (!parsedData.clientId) {
          parsedData.clientId = clientId;
        }
        if (!parsedData.timestamp) {
          parsedData.timestamp = new Date().toISOString();
        }
      }

      // Validate message with Zod
      const validatedMessage = MessageSchema.parse(parsedData);

      // Update stats
      this.stats.totalMessages++;
      this.stats.messagesByType[validatedMessage.type]++;

      // Call custom handler
      await this.customHandler(validatedMessage);
    } catch (error) {
      console.error("Message validation failed:", error);

      // Create error message and send to custom handler
      const errorMessage: Message = {
        type: "error",
        clientId,
        timestamp: new Date().toISOString(),
        payload: {
          message: error instanceof Error ? error.message : "Unknown error",
          code: "VALIDATION_ERROR",
        },
      };

      this.stats.totalMessages++;
      this.stats.messagesByType["error"]++;

      await this.customHandler(errorMessage);
    }
  }

  public getStats() {
    return { ...this.stats };
  }

  public resetStats() {
    this.stats.totalMessages = 0;
    Object.keys(this.stats.messagesByType).forEach((type) => {
      this.stats.messagesByType[type as MessageType] = 0;
    });
  }
}
