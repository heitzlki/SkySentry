import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { type WebcamFrame } from "./messageTypes.js";

export class ImageHandler {
  private frameCounter = 0;
  private assetsDir = "./assets";

  constructor() {
    this.ensureAssetsDir();
  }

  private async ensureAssetsDir(): Promise<void> {
    try {
      await mkdir(this.assetsDir, { recursive: true });
    } catch (error) {
      console.error("Failed to create assets directory:", error);
    }
  }

  /**
   * Process webcam frame data - prints byte preview and saves image
   */
  public async processWebcamFrame(frame: WebcamFrame): Promise<void> {
    try {
      this.frameCounter++;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

      // Print byte preview
      this.printBytePreview(frame);

      // Process the image data
      let imageBuffer: Buffer;

      if (
        frame.payload.format === "binary" &&
        frame.payload.data === "binary_data_placeholder"
      ) {
        // This is a placeholder - we can't save this
        console.log(
          `⚠️  [IMAGE] Cannot save placeholder binary data for frame ${this.frameCounter}`
        );
        return;
      }

      // Handle different data formats
      if (frame.payload.data.includes(",")) {
        // Array format: "1,2,3,4..." from frontend
        const byteArray = frame.payload.data
          .split(",")
          .map((str) => parseInt(str.trim(), 10));
        imageBuffer = Buffer.from(byteArray);
      } else {
        // Base64 format
        try {
          imageBuffer = Buffer.from(frame.payload.data, "base64");
        } catch (error) {
          console.error("Failed to decode base64 image data:", error);
          return;
        }
      }

      // Validate buffer
      if (imageBuffer.length === 0) {
        console.log(
          `⚠️  [IMAGE] Empty image buffer for frame ${this.frameCounter}`
        );
        return;
      }

      // Generate filename with proper clientId from the frame
      const filename = `frame_${this.frameCounter}_${frame.clientId}_${timestamp}.jpg`;
      const filepath = join(this.assetsDir, filename);

      // Save the image
      await writeFile(filepath, imageBuffer);

      console.log(
        `💾 [IMAGE] Saved frame ${this.frameCounter}: ${filepath} (${imageBuffer.length} bytes)`
      );

      // Print some image metadata
      this.printImageMetadata(imageBuffer, filename);
    } catch (error) {
      console.error(
        `❌ [IMAGE] Error processing frame ${this.frameCounter}:`,
        error
      );
    }
  }

  /**
   * Print a preview of the image bytes
   */
  private printBytePreview(frame: WebcamFrame): void {
    const { payload, clientId } = frame;

    console.log(
      `\n🖼️  [IMAGE PREVIEW] Frame #${this.frameCounter} from ${clientId}`
    );
    console.log(`   Format: ${payload.format}`);
    console.log(`   Size: ${payload.size} bytes`);

    // Print first few bytes as preview
    if (payload.data && payload.data !== "binary_data_placeholder") {
      let previewBytes: string;

      if (payload.data.includes(",")) {
        // Array format
        const firstBytes = payload.data.split(",", 16).join(", ");
        previewBytes = `[${firstBytes}${
          payload.data.split(",").length > 16 ? ", ..." : ""
        }]`;
      } else {
        // Base64 or other format
        const preview = payload.data.substring(0, 32);
        previewBytes = `"${preview}${payload.data.length > 32 ? "..." : ""}"`;
      }

      console.log(`   Data preview: ${previewBytes}`);
    } else {
      console.log(`   Data: ${payload.data}`);
    }

    console.log(`   Timestamp: ${frame.timestamp}`);
  }

  /**
   * Print metadata about the saved image
   */
  private printImageMetadata(buffer: Buffer, filename: string): void {
    // Check if it's a JPEG by looking at magic bytes
    const isJPEG =
      buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8;
    const isPNG =
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47;

    let fileType = "Unknown";
    if (isJPEG) fileType = "JPEG";
    else if (isPNG) fileType = "PNG";

    console.log(`   📊 File: ${filename}`);
    console.log(`   📊 Type: ${fileType} (detected from magic bytes)`);
    console.log(`   📊 Buffer size: ${buffer.length} bytes`);
    console.log(
      `   📊 First 8 bytes: [${Array.from(buffer.slice(0, 8))
        .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
        .join(", ")}]`
    );
  }

  /**
   * Get statistics about processed frames
   */
  public getStats(): { totalFrames: number; assetsDir: string } {
    return {
      totalFrames: this.frameCounter,
      assetsDir: this.assetsDir,
    };
  }

  /**
   * Reset frame counter
   */
  public resetStats(): void {
    this.frameCounter = 0;
  }
}
