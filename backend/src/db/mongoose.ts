import mongoose from 'mongoose';
import { logger } from '../lib/logger.js';
import { Alert } from '../models/alert.model.js';
import { ApiCheck } from '../models/apiCheck.model.js';
import { MonitorRun } from '../models/monitorRun.model.js';

const SERVER_SELECTION_TIMEOUT_MS = 5_000;

let connected = false;
let disconnecting = false;

// Mongoose also emits 'disconnected' when the first connection attempt fails; only a lost connection is news.
mongoose.connection.on('disconnected', () => {
  if (connected && !disconnecting) logger.warn('MongoDB connection lost; the driver keeps retrying');
});
mongoose.connection.on('reconnected', () => logger.info('MongoDB connection restored'));

export async function connectToDatabase(uri: string): Promise<void> {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS });
  connected = true;
  // Build indexes before any batch runs: the "one active alert per API" unique index enforces dedupe.
  await Promise.all([Alert.init(), ApiCheck.init(), MonitorRun.init()]);
  logger.info({ uri: redactMongoUri(uri) }, 'Connected to MongoDB');
}

export async function disconnectFromDatabase(): Promise<void> {
  disconnecting = true;
  await mongoose.disconnect();
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}

/** Hides the password in a MongoDB URI so the URI can be logged. */
export function redactMongoUri(uri: string): string {
  return uri.replace(/\/\/([^/@:]+):[^/@]*@/, '//$1:***@');
}
