import { treaty } from "@elysiajs/eden";
import type { API } from "../../../stream/api";

// Create the Eden client
export const api = treaty<API>(
  process.env.NEXT_PUBLIC_API_URL || "https://demo3001.shivi.io"
);

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
