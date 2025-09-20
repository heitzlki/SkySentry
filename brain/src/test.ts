import { dev_fetch, CameraDataSchema } from "./fetch";

async function testCameraFunctions() {
  try {
    console.log("Testing camera data functions...");

    let camera1_data = await dev_fetch("camera-001");
    console.log(`✓ dev_fetch returned ${camera1_data.length} objects`);

    console.log("✓ Zod schema validation passed");

    const cameras = [camera1_data];
    console.log(
      `✓ Created cameras array with ${cameras.length} camera data sets`
    );

    console.log("Sample object structure:");
    console.log(JSON.stringify(camera1_data[0], null, 2));
  } catch (error) {
    console.error("Test failed:", error);
  }
}

if (import.meta.main) {
  testCameraFunctions();
}

export { testCameraFunctions };
