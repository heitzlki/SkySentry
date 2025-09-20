interface MessageData {
  type: string;
  payload: any;
  timestamp?: string;
  clientId?: string;
}

export class MessageHandler {
  private messageCount = 0;
  private webcamFrameCount = 0;

  public handleMessage(message: string | Buffer, clientId?: string): void {
    this.messageCount++;
    const timestamp = new Date().toISOString();

    try {
      // Try to parse as JSON first (for text messages and metadata)
      const data: MessageData = JSON.parse(message.toString());

      if (data.type === "data-channel-message") {
        this.handleDataChannelMessage(data.payload, clientId, timestamp);
      } else {
        this.handleGenericMessage(data, clientId, timestamp);
      }
    } catch (error) {
      // If JSON parsing fails, treat as raw binary data
      this.handleBinaryMessage(message, clientId, timestamp);
    }
  }

  private handleDataChannelMessage(
    payload: any,
    clientId?: string,
    timestamp?: string
  ): void {
    if (typeof payload === "string") {
      if (payload.startsWith("[Binary data:")) {
        // This is a binary data notification from frontend
        this.webcamFrameCount++;
        console.log(
          `[WEBCAM FRAME] ${clientId}: Frame #${this.webcamFrameCount} - ${payload} at ${timestamp}`
        );
      } else {
        // Regular text message
        console.log(`[TEXT MSG] ${clientId}: ${payload} at ${timestamp}`);
      }
    } else {
      // Direct binary data (shouldn't happen via WebSocket, but just in case)
      console.log(
        `[BINARY MSG] ${clientId}: ${
          payload?.byteLength || "Unknown"
        } bytes at ${timestamp}`
      );
    }
  }

  private handleBinaryMessage(
    message: string | Buffer,
    clientId?: string,
    timestamp?: string
  ): void {
    const size = Buffer.isBuffer(message) ? message.length : message.length;
    console.log(`[RAW BINARY] ${clientId}: ${size} bytes at ${timestamp}`);
  }

  private handleGenericMessage(
    data: MessageData,
    clientId?: string,
    timestamp?: string
  ): void {
    console.log(
      `[GENERIC MSG] ${clientId}: Type: ${data.type}, Data: ${JSON.stringify(
        data
      ).substring(0, 100)}... at ${timestamp}`
    );
  }

  public getStats(): { totalMessages: number; webcamFrames: number } {
    return {
      totalMessages: this.messageCount,
      webcamFrames: this.webcamFrameCount,
    };
  }

  public resetStats(): void {
    this.messageCount = 0;
    this.webcamFrameCount = 0;
  }
}
