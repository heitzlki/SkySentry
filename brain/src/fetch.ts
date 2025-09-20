import { CameraDataSchema, CameraData, CameraDataFetcher } from "./types";
import exampleResponse from "../example-response.json";

let i = 0;

class DevCameraDataFetcher implements CameraDataFetcher {
  async fetch(cameraId: string): Promise<CameraData> {
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 100 + 50)
    );

    const singleObject = [exampleResponse[i]];
    i++;
    if (i >= exampleResponse.length) i = 0;

    return CameraDataSchema.parse(singleObject);
  }
}

// TODO: unsure if this works as intended
class ProdCameraDataFetcher implements CameraDataFetcher {
  async fetch(cameraId: string): Promise<CameraData> {
    const response = await fetch(`/api/camera/${cameraId}/data`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const rawData = await response.json();
    return CameraDataSchema.parse(rawData);
  }
}

const devFetcher = new DevCameraDataFetcher();
const prodFetcher = new ProdCameraDataFetcher();

export async function dev_fetch(cameraId: string): Promise<CameraData> {
  return devFetcher.fetch(cameraId);
}

export async function fetchCameraData(cameraId: string): Promise<CameraData> {
  return prodFetcher.fetch(cameraId);
}

export { CameraDataSchema, DevCameraDataFetcher, ProdCameraDataFetcher };
