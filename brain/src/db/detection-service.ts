import { db, detectionObjects } from "./database";
import { DetectionObject, SimpleZwObject, CameraDataObject } from "../types";
import { eq, desc } from "drizzle-orm";

export class DetectionDataService {
  async storeDetectionData(
    cameraId: string,
    data: CameraDataObject[]
  ): Promise<void> {
    const timestamp = new Date();

    for (const item of data) {
      // Only store DetectionObjects, skip SimpleZwObjects
      if ("Zw" in item && Object.keys(item).length === 1) {
        // This is a SimpleZwObject, skip it
        continue;
      }

      const detectionObject = item as DetectionObject;

      await db.insert(detectionObjects).values({
        cameraId,
        timestamp,
        frame: detectionObject.frame,
        global_id: detectionObject.global_id,
        label: detectionObject.label,
        x1: detectionObject.x1,
        y1: detectionObject.y1,
        x2: detectionObject.x2,
        y2: detectionObject.y2,
        cx: detectionObject.cx,
        cy: detectionObject.cy,
        Xc: detectionObject.Xc,
        Yc: detectionObject.Yc,
        Zc: detectionObject.Zc,
        Xw: detectionObject.Xw,
        Yw: detectionObject.Yw,
        Zw: detectionObject.Zw,
      });
    }
  }

  async getLatestDetections(cameraId: string, limit: number = 10) {
    return await db
      .select()
      .from(detectionObjects)
      .where(eq(detectionObjects.cameraId, cameraId))
      .orderBy(desc(detectionObjects.timestamp))
      .limit(limit);
  }

  async getAllDetections() {
    return await db
      .select()
      .from(detectionObjects)
      .orderBy(desc(detectionObjects.timestamp));
  }

  async getDetectionCount(): Promise<number> {
    const result = await db
      .select({ count: detectionObjects.id })
      .from(detectionObjects);
    return result.length;
  }
}

export const detectionService = new DetectionDataService();
