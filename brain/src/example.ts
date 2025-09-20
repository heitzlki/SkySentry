import { dev_fetch, CameraData } from "./index";

async function exampleUsage() {
  const camera1_data = await dev_fetch("camera-001");
  const cameras: CameraData[] = [camera1_data];

  console.log(`Loaded ${cameras.length} camera data sets`);
  console.log(`Camera 1 has ${camera1_data.length} data points`);

  return cameras;
}

async function fetchMultipleCameras(
  cameraIds: string[]
): Promise<CameraData[]> {
  const cameras = await Promise.all(cameraIds.map((id) => dev_fetch(id)));
  return cameras;
}

async function safeFetchCamera(cameraId: string): Promise<CameraData | null> {
  try {
    const data = await dev_fetch(cameraId);
    console.log(
      `Successfully fetched ${data.length} objects for camera ${cameraId}`
    );
    return data;
  } catch (error) {
    console.error(`Failed to fetch data for camera ${cameraId}:`, error);
    return null;
  }
}

export { exampleUsage, fetchMultipleCameras, safeFetchCamera };
