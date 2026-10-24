// Input method 1: runs a JSON file of API results through the same pipeline as POST /monitor.
// Usage (from the project root): npm run monitor:file -- [path/to/batch.json]
// Without a path it processes sample-data/sample-batch.json.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/env.js';
import { connectToDatabase, disconnectFromDatabase, redactMongoUri } from '../db/mongoose.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { runMonitor, type MonitorResult } from '../modules/monitor/monitor.service.js';
import { pendingDigestEmails } from '../services/notifier/alertEmail.js';
import type { SentEmail } from '../services/notifier/email.js';

const DEFAULT_FILE = path.resolve(import.meta.dirname, '../../../sample-data/sample-batch.json');
// npm runs workspace scripts inside backend/, so relative paths are resolved from where npm was started.
const BASE_DIR = process.env.INIT_CWD ?? process.cwd();

async function main(): Promise<number> {
  // The summary table is the output, so at the default level only warnings and errors are logged.
  // LOG_LEVEL=debug shows every log line.
  if (logger.level === 'info') logger.level = 'warn';

  const filePath = process.argv[2] ? path.resolve(BASE_DIR, process.argv[2]) : DEFAULT_FILE;
  let body: unknown;
  try {
    body = JSON.parse(stripBom(await readFile(filePath, 'utf8')));
  } catch (error) {
    console.error(`Cannot read a JSON batch from ${filePath}: ${(error as Error).message}`);
    return 1;
  }

  try {
    await connectToDatabase(config.mongoUri);
  } catch {
    console.error(`Cannot connect to MongoDB at ${redactMongoUri(config.mongoUri)}. Start it with "npm run db:up".`);
    return 1;
  }

  try {
    printSummary(filePath, await runMonitor(body, 'file'));
    printDigests(await pendingDigestEmails());
    return 0;
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    console.error(`${error.code}: ${error.message}`);
    if (error.details !== undefined) console.error(JSON.stringify(error.details, null, 2));
    return 1;
  } finally {
    // With EMAIL_ENABLED, a digest email may still be sending, and it reads its alerts from MongoDB.
    await pendingDigestEmails();
    await disconnectFromDatabase();
  }
}

function printDigests(digests: ReadonlyArray<SentEmail | null>): void {
  for (const sent of digests) {
    if (sent) console.log(`\nDigest email sent to ${sent.to}.${sent.previewUrl ? ` Preview it at ${sent.previewUrl}` : ''}`);
  }
}

function printSummary(filePath: string, result: MonitorResult): void {
  const header = ['API', 'Result', 'Issues'];
  const rows = result.results.map((check) => [
    check.apiName,
    check.severity,
    check.issues.map((issue) => issue.type).join(', ') || '-',
  ]);
  const widths = header.map((title, column) => Math.max(title.length, ...rows.map((row) => row[column]?.length ?? 0)));
  const line = (cells: string[]) => cells.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join('  ').trimEnd();

  console.log(`\nMonitor run ${result.runId} - ${path.relative(BASE_DIR, filePath)}\n`);
  console.log(line(header));
  console.log(line(widths.map((width) => '-'.repeat(width))));
  for (const row of rows) console.log(line(row));

  const { alerts, llm } = result;
  console.log(
    `\nReceived ${result.received}, processed ${result.processed}, invalid ${result.invalid.length}, ` +
      `healthy ${result.healthy}, anomalies ${result.anomalies}`,
  );
  console.log(`Alerts: ${alerts.created} created, ${alerts.updated} updated, ${alerts.autoResolved} auto-resolved`);
  console.log(`LLM: ${llm.mode} mode, ${llm.calls} calls, ${llm.fallbacks} fallbacks. Took ${result.durationMs} ms.`);
  if (result.invalid.length > 0) {
    console.log('\nInvalid items:');
    for (const item of result.invalid) console.log(`  #${item.index}: ${item.reason}`);
  }
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

main().then(
  (code) => finish(code),
  (error: unknown) => {
    console.error(error);
    finish(1);
  },
);

/**
 * Lets the process exit on its own, so every line reaches the terminal. After verbose logging, pino's log transport
 * can keep the process alive (its worker thread never reports that it closed), so stop waiting after 2 seconds.
 */
function finish(code: number): void {
  process.exitCode = code;
  setTimeout(() => process.exit(code), 2_000).unref();
}
