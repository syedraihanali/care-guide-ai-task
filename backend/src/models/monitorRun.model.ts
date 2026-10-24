import { Schema, model } from 'mongoose';
import { LLM_MODES, RUN_SOURCES, type LlmMode, type RunSource } from '../domain/monitoring.js';
import { jsonOutput } from './shared.js';

/** One processed batch, from POST /monitor or the file CLI. */
export interface MonitorRunAttrs {
  source: RunSource;
  received: number;
  processed: number;
  invalid: Array<{ index: number; reason: string }>;
  healthy: number;
  anomalies: number;
  alerts: { created: number; updated: number; autoResolved: number };
  llm: { mode: LlmMode; calls: number; fallbacks: number; tokens: number; latencyMs: number };
  durationMs: number;
  startedAt: Date;
}

const invalidItemSchema = new Schema({ index: Number, reason: String }, { _id: false });

const monitorRunSchema = new Schema<MonitorRunAttrs>(
  {
    source: { type: String, enum: RUN_SOURCES, required: true },
    received: { type: Number, required: true },
    processed: { type: Number, required: true },
    invalid: { type: [invalidItemSchema], default: [] },
    healthy: { type: Number, required: true },
    anomalies: { type: Number, required: true },
    alerts: {
      created: { type: Number, required: true },
      updated: { type: Number, required: true },
      autoResolved: { type: Number, required: true },
    },
    llm: {
      mode: { type: String, enum: LLM_MODES, required: true },
      calls: { type: Number, required: true },
      fallbacks: { type: Number, required: true },
      tokens: { type: Number, required: true },
      latencyMs: { type: Number, required: true },
    },
    durationMs: { type: Number, required: true },
    startedAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, toJSON: jsonOutput },
);

export const MonitorRun = model<MonitorRunAttrs>('MonitorRun', monitorRunSchema);
