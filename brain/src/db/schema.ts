import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';

export const detectionObjects = sqliteTable('detection_objects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cameraId: text('camera_id').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  frame: integer('frame'),
  global_id: integer('global_id'),
  label: text('label'),
  x1: real('x1'),
  y1: real('y1'),
  x2: real('x2'),
  y2: real('y2'),
  cx: real('cx'),
  cy: real('cy'),
  Xc: real('Xc'),
  Yc: real('Yc'),
  Zc: real('Zc'),
  Xw: real('Xw'),
  Yw: real('Yw'),
  Zw: real('Zw').notNull(),
});

export type DetectionObjectRow = typeof detectionObjects.$inferInsert;
export type DetectionObjectSelect = typeof detectionObjects.$inferSelect;
