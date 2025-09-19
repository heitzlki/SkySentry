import { z } from "zod";

// Enumerated message types
export type MessageType =
  | "text_message"
  | "webcam_frame"
  | "connection_status"
  | "heartbeat"
  | "error";

// Zod schemas for validation
export const MessageTypeSchema = z.enum([
  "text_message",
  "webcam_frame",
  "connection_status",
  "heartbeat",
  "error",
]);

export const BaseMessageSchema = z.object({
  type: MessageTypeSchema,
  clientId: z.string(),
  timestamp: z.string().optional(),
});

export const TextMessageSchema = BaseMessageSchema.extend({
  type: z.literal("text_message"),
  payload: z.string(),
});

export const WebcamFrameSchema = BaseMessageSchema.extend({
  type: z.literal("webcam_frame"),
  payload: z.object({
    data: z.string(), // base64 encoded or binary data identifier
    size: z.number(),
    format: z.string().default("jpeg"),
  }),
});

export const ConnectionStatusSchema = BaseMessageSchema.extend({
  type: z.literal("connection_status"),
  payload: z.object({
    status: z.enum(["connected", "disconnected", "error"]),
    details: z.string().optional(),
  }),
});

export const HeartbeatSchema = BaseMessageSchema.extend({
  type: z.literal("heartbeat"),
  payload: z.object({
    timestamp: z.string(),
  }),
});

export const ErrorMessageSchema = BaseMessageSchema.extend({
  type: z.literal("error"),
  payload: z.object({
    message: z.string(),
    code: z.string().optional(),
  }),
});

// Union type for all possible messages
export const MessageSchema = z.discriminatedUnion("type", [
  TextMessageSchema,
  WebcamFrameSchema,
  ConnectionStatusSchema,
  HeartbeatSchema,
  ErrorMessageSchema,
]);

export type Message = z.infer<typeof MessageSchema>;
export type TextMessage = z.infer<typeof TextMessageSchema>;
export type WebcamFrame = z.infer<typeof WebcamFrameSchema>;
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;
export type Heartbeat = z.infer<typeof HeartbeatSchema>;
export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;
