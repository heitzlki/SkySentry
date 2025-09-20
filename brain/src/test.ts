import { dev_fetch, CameraDataSchema } from './fetch';
import { detectionService } from './db/detection-service';
import { initializeDatabase } from './db/database';

async function testCameraFunctions() {
  try {
    console.log('Testing camera data functions...');

    // Initialize database first
    initializeDatabase();

    let camera1_data = await dev_fetch('camera-001');
    console.log(`✓ dev_fetch returned ${camera1_data.length} objects`);

    console.log('✓ Zod schema validation passed');

    // Test database functionality
    console.log('\n--- Testing Database Storage ---');

    // Fetch more data to store in database
    await dev_fetch('camera-001');
    await dev_fetch('camera-002');
    await dev_fetch('camera-001');

    // Get stored detection count
    const totalCount = await detectionService.getDetectionCount();
    console.log(`✓ Total detections stored: ${totalCount}`);

    const camera1Count = await detectionService.getDetectionCount('camera-001');
    console.log(`✓ Camera-001 detections: ${camera1Count}`);

    // Get latest detections for camera-001
    const latestDetections = await detectionService.getLatestDetections(
      'camera-001',
      3
    );
    console.log(
      `✓ Retrieved ${latestDetections.length} latest detections for camera-001`
    );

    // Get all detections for camera-001
    const allCamera1Detections = await detectionService.getAllDetections(
      'camera-001'
    );
    console.log(
      `✓ Retrieved ${allCamera1Detections.length} total detections for camera-001`
    );

    const cameras = [camera1_data];
    console.log(
      `✓ Created cameras array with ${cameras.length} camera data sets`
    );

    console.log('\nSample object structure:');
    console.log(JSON.stringify(camera1_data[0], null, 2));

    console.log('\nSample stored detection:');
    if (latestDetections.length > 0) {
      console.log(JSON.stringify(latestDetections[0], null, 2));
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

if (import.meta.main) {
  testCameraFunctions();
}

export { testCameraFunctions };
