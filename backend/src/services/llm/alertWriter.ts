import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import pLimit from 'p-limit';
import { z } from 'zod';
import { config } from '../../config/env.js';
import type { LlmMode } from '../../domain/monitoring.js';
import { logger } from '../../lib/logger.js';
import { SYSTEM_PROMPT, buildUserMessage } from './prompts.js';
import { templateAlert } from './templateAlert.js';
import type { AlertText, AlertTextRequest } from './types.js';

/** How many LLM calls may run at once when a batch needs several chunks. */
const CHUNK_CONCURRENCY = 3;
const TEMPERATURE = 0.2;

/** The model's answer. The SDK turns this into the strict JSON schema sent to OpenAI. */
const generatedAlertsSchema = z.object({
  alerts: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      message: z.string(),
      likelyCause: z.string(),
      suggestedAction: z.string(),
    }),
  ),
});
type GeneratedAlert = z.infer<typeof generatedAlertsSchema>['alerts'][number];

// The prompt asks for at most 8 and 40 words. These looser caps only reject output that is clearly off,
// because a slightly long AI alert is still more useful than a template.
const MAX_TITLE_WORDS = 12;
const MAX_MESSAGE_WORDS = 60;
const MAX_FIELD_LENGTH = 600;

export interface WrittenAlertText extends AlertText {
  aiGenerated: boolean;
  aiModel: string | null;
}

export interface AlertWriterStats {
  mode: LlmMode;
  calls: number;
  fallbacks: number;
  tokens: number;
  latencyMs: number;
}

/** The part of the OpenAI client the writer uses, so tests can pass a fake one. */
export type ChatCompletionsClient = Pick<OpenAI, 'chat'>;

export interface AlertWriterOptions {
  apiKey: string | undefined;
  model: string;
  timeoutMs: number;
  batchSize: number;
  client?: ChatCompletionsClient;
}

/**
 * Writes human-readable alert text with the LLM, one call per chunk of alerts.
 * It never throws: an alert the LLM could not write gets the deterministic template instead.
 */
export class AlertWriter {
  readonly mode: LlmMode;
  readonly model: string;
  private readonly batchSize: number;
  private readonly client: ChatCompletionsClient | null;

  constructor(options: AlertWriterOptions) {
    this.model = options.model;
    this.batchSize = options.batchSize;
    this.client =
      options.client ??
      (options.apiKey ? new OpenAI({ apiKey: options.apiKey, timeout: options.timeoutMs, maxRetries: 1 }) : null);
    this.mode = this.client ? 'ai' : 'template';
  }

  async write(
    requests: readonly AlertTextRequest[],
  ): Promise<{ texts: Map<string, WrittenAlertText>; stats: AlertWriterStats }> {
    const texts = new Map<string, WrittenAlertText>();
    const stats: AlertWriterStats = { mode: this.mode, calls: 0, fallbacks: 0, tokens: 0, latencyMs: 0 };
    const client = this.client;
    if (!client) {
      for (const request of requests) texts.set(request.id, fromTemplate(request));
      return { texts, stats };
    }

    const limit = pLimit(CHUNK_CONCURRENCY);
    await Promise.all(
      chunk(requests, this.batchSize).map((group) =>
        limit(async () => {
          const generated = await this.generate(client, group, stats);
          for (const request of group) {
            const text = generated.get(request.id);
            if (text) {
              texts.set(request.id, { ...text, aiGenerated: true, aiModel: this.model });
            } else {
              texts.set(request.id, fromTemplate(request));
              stats.fallbacks += 1;
            }
          }
        }),
      ),
    );
    return { texts, stats };
  }

  /** One LLM call for one chunk. Returns the valid texts by alert id; a failed call is logged and returns none. */
  private async generate(
    client: ChatCompletionsClient,
    group: readonly AlertTextRequest[],
    stats: AlertWriterStats,
  ): Promise<Map<string, AlertText>> {
    const started = performance.now();
    stats.calls += 1;
    try {
      const completion = await client.chat.completions.parse({
        model: this.model,
        temperature: TEMPERATURE,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserMessage(group) },
        ],
        response_format: zodResponseFormat(generatedAlertsSchema, 'alert_texts'),
      });
      const latencyMs = Math.round(performance.now() - started);
      const usage = completion.usage;
      stats.latencyMs += latencyMs;
      stats.tokens += usage?.total_tokens ?? 0;

      const message = completion.choices[0]?.message;
      const texts = validTexts(message?.parsed?.alerts ?? [], group);
      logger.info(
        {
          model: this.model,
          alerts: group.length,
          written: texts.size,
          latencyMs,
          promptTokens: usage?.prompt_tokens,
          completionTokens: usage?.completion_tokens,
        },
        'LLM wrote alert texts',
      );
      if (texts.size < group.length) {
        logger.warn(
          { missing: group.length - texts.size, refusal: message?.refusal ?? undefined },
          'LLM output was missing or invalid for some alerts; using templates for them',
        );
      }
      return texts;
    } catch (error) {
      stats.latencyMs += Math.round(performance.now() - started);
      logger.warn({ err: error, alerts: group.length }, 'LLM call failed; using template alerts');
      return new Map();
    }
  }
}

/** Keeps one valid text per requested alert id, ignoring unknown ids and duplicates. */
function validTexts(generated: readonly GeneratedAlert[], group: readonly AlertTextRequest[]): Map<string, AlertText> {
  const wanted = new Set(group.map((request) => request.id));
  const texts = new Map<string, AlertText>();
  for (const item of generated) {
    if (!wanted.has(item.id) || texts.has(item.id)) continue;
    const text = cleanText(item);
    if (text) texts.set(item.id, text);
  }
  return texts;
}

function cleanText(item: GeneratedAlert): AlertText | null {
  const text: AlertText = {
    title: item.title.trim(),
    message: item.message.trim(),
    likelyCause: item.likelyCause.trim(),
    suggestedAction: item.suggestedAction.trim(),
  };
  const fieldsOk = Object.values(text).every((value) => value.length > 0 && value.length <= MAX_FIELD_LENGTH);
  const lengthsOk = wordCount(text.title) <= MAX_TITLE_WORDS && wordCount(text.message) <= MAX_MESSAGE_WORDS;
  return fieldsOk && lengthsOk ? text : null;
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function fromTemplate(request: AlertTextRequest): WrittenAlertText {
  return { ...templateAlert(request), aiGenerated: false, aiModel: null };
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) chunks.push(items.slice(start, start + size));
  return chunks;
}

export const alertWriter = new AlertWriter(config.llm);
