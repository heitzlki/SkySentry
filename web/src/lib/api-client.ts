import { treaty } from "@elysiajs/eden";
import type { App } from "../../../brain/src/index";

// Create the Eden client
export const client = treaty<App>("http://localhost:4000");

// Types for the camera data
export interface CameraData {
  id: string;
  image: string | null;
  timestamp: string | null;
  frameNumber: number;
  size: number;
  status: "online" | "offline";
}

export interface CamerasResponse {
  success: boolean;
  cameras: CameraData[];
  count: number;
  error?: string;
}
