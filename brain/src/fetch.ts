import { CameraDataSchema, CameraData, CameraDataFetcher } from "./types";
import { detectionService } from "./db/detection-service";
import exampleResponse from "../example-response.json";

let i = 0;

class DevCameraDataFetcher implements CameraDataFetcher {
  async fetch(cameraId: string): Promise<CameraData> {
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 100 + 50)
    );

    // We now only have one camera, so we can simplify this.
    // The cameraId is now hardcoded to "camera-001" in dev_fetch.
    const singleObject = [exampleResponse[i]];
    i++;
    if (i >= exampleResponse.length) i = 0;

    const validatedData = CameraDataSchema.parse(singleObject);

    // Store the data in the database
    try {
      await detectionService.storeDetectionData(cameraId, validatedData);
    } catch (error) {
      console.error(
        `Failed to store detection data for camera ${cameraId}:`,
        error
      );
    }

    return validatedData;
  }
}

// TODO: unsure if this works as intended
class ProdCameraDataFetcher implements CameraDataFetcher {
  async fetch(cameraId: string): Promise<CameraData> {
    const response = await fetch(`/api/camera/${cameraId}/data`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const rawData = await response.json();
    const validatedData = CameraDataSchema.parse(rawData);

    // Store the data in the database
    try {
      await detectionService.storeDetectionData(cameraId, validatedData);
    } catch (error) {
      console.error(
        `Failed to store detection data for camera ${cameraId}:`,
        error
      );
    }

    return validatedData;
  }
}

const devFetcher = new DevCameraDataFetcher();
const prodFetcher = new ProdCameraDataFetcher();

export async function dev_fetch(
  cameraId: string = "camera-001"
): Promise<CameraData> {
  return devFetcher.fetch(cameraId);
}

export async function fetchCameraData(cameraId: string): Promise<CameraData> {
  return prodFetcher.fetch(cameraId);
}

export { CameraDataSchema, DevCameraDataFetcher, ProdCameraDataFetcher };
