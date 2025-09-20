import { z } from "zod";

export const DetectionObjectSchema = z.object({
  frame: z.number().optional(),
  global_id: z.number().optional(),
  label: z.string().optional(),
  x1: z.number().optional(),
  y1: z.number().optional(),
  x2: z.number().optional(),
  y2: z.number().optional(),
  cx: z.number().optional(),
  cy: z.number().optional(),
  Xc: z.number().optional(),
  Yc: z.number().optional(),
  Zc: z.number().optional(),
  Xw: z.number().optional(),
  Yw: z.number().optional(),
  Zw: z.number(),
});

export const SimpleZwObjectSchema = z.object({
  Zw: z.number(),
});

export const CameraDataObjectSchema = z.union([
  DetectionObjectSchema,
  SimpleZwObjectSchema,
]);

export const CameraDataSchema = z.array(CameraDataObjectSchema);

export type DetectionObject = z.infer<typeof DetectionObjectSchema>;
export type SimpleZwObject = z.infer<typeof SimpleZwObjectSchema>;
export type CameraDataObject = z.infer<typeof CameraDataObjectSchema>;
export type CameraData = z.infer<typeof CameraDataSchema>;

export interface CameraResponse {
  cameraId: string;
  timestamp: Date;
  data: CameraData;
}

export interface CameraDataFetcher {
  fetch(cameraId: string): Promise<CameraData>;
}
