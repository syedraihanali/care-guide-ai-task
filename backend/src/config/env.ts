import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';
import { blankToUndefined } from '../lib/validation.js';

// backend/.env, located relative to this file so it loads whatever the working directory is.
// Tests skip it: they run on the defaults, whatever a developer's .env contains.
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true });
}

/** Every variable is optional: a missing or blank value falls back to its default. */
const optional = <T extends z.ZodType>(schema: T) => z.preprocess(blankToUndefined, schema);

const envSchema = z.object({
  NODE_ENV: optional(z.enum(['development', 'production', 'test']).default('development')),
  PORT: optional(z.coerce.number().int().min(1).max(65535).default(4000)),
  MONGODB_URI: optional(
    z
      .string()
      .regex(/^mongodb(\+srv)?:\/\//, 'must start with mongodb:// or mongodb+srv://')
      .default('mongodb://localhost:27017/api_monitor'),
  ),
  CORS_ORIGIN: optional(z.string().default('http://localhost:5173')),
  LOG_LEVEL: optional(z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info')),
  OPENAI_API_KEY: optional(z.string().optional()),
  OPENAI_MODEL: optional(z.string().default('gpt-4o-mini')),
  LLM_TIMEOUT_MS: optional(z.coerce.number().int().positive().default(15_000)),
  LLM_BATCH_SIZE: optional(z.coerce.number().int().min(1).max(100).default(20)),
  AUTO_RESOLVE_ON_RECOVERY: optional(z.stringbool().default(true)),
  MAX_BATCH_SIZE: optional(z.coerce.number().int().positive().default(1000)),
  EMAIL_ENABLED: optional(z.stringbool().default(false)),
  EMAIL_TO: optional(z.string().optional()),
  EMAIL_FROM: optional(z.string().optional()),
  SMTP_HOST: optional(z.string().optional()),
  SMTP_PORT: optional(z.coerce.number().int().min(1).max(65535).default(587)),
  SMTP_USER: optional(z.string().optional()),
  SMTP_PASS: optional(z.string().optional()),
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // The logger is configured from these values, so this goes straight to stderr.
    console.error(`Invalid backend configuration:\n${z.prettifyError(result.error)}`);
    process.exit(1);
  }
  return result.data;
}

const env = loadEnv();

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  port: env.PORT,
  mongoUri: env.MONGODB_URI,
  corsOrigins: env.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  logLevel: env.LOG_LEVEL,
  llm: {
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
    timeoutMs: env.LLM_TIMEOUT_MS,
    batchSize: env.LLM_BATCH_SIZE,
  },
  monitor: {
    autoResolveOnRecovery: env.AUTO_RESOLVE_ON_RECOVERY,
    maxBatchSize: env.MAX_BATCH_SIZE,
  },
  email: {
    enabled: env.EMAIL_ENABLED,
    to: env.EMAIL_TO,
    from: env.EMAIL_FROM,
    smtp: { host: env.SMTP_HOST, port: env.SMTP_PORT, user: env.SMTP_USER, pass: env.SMTP_PASS },
  },
} as const;
