import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../src/config/thresholds.js';
import { AlertWriter, type ChatCompletionsClient } from '../src/services/llm/alertWriter.js';
import { templateAlert } from '../src/services/llm/templateAlert.js';
import type { AlertTextRequest } from '../src/services/llm/types.js';

function request(id: string): AlertTextRequest {
  return {
    id,
    apiName: `API${id}`,
    severity: 'critical',
    occurrences: 1,
    issues: [{ type: 'SERVER_ERROR', severity: 'critical', detail: 'HTTP 500 server error' }],
    metrics: { statusCode: 500, responseTimeMs: 1200, recordsReturned: 4 },
    thresholds: { ...DEFAULT_THRESHOLDS },
  };
}

function aiText(id: string) {
  return {
    id,
    title: `API${id} is failing`,
    message: `API${id} returned HTTP 500 in 1200 ms.`,
    likelyCause: 'Likely an outage in the service.',
    suggestedAction: 'Check the server logs.',
  };
}

function completion(alerts: unknown[] | null, refusal: string | null = null) {
  return {
    choices: [{ message: { parsed: alerts === null ? null : { alerts }, refusal } }],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  };
}

/** An AlertWriter whose OpenAI client is a mock: `answer` plays the role of chat.completions.parse(). */
function writerWith(answer: (body: unknown) => unknown, batchSize = 20) {
  const parse = vi.fn(async (body: unknown) => answer(body));
  const client = { chat: { completions: { parse } } } as unknown as ChatCompletionsClient;
  const writer = new AlertWriter({ apiKey: undefined, model: 'test-model', timeoutMs: 1_000, batchSize, client });
  return { writer, parse };
}

/** The alerts sent in one call, read back from its user message. */
function sentAlerts(body: unknown): Array<Record<string, unknown>> {
  const { messages } = body as { messages: Array<{ role: string; content: string }> };
  const user = messages.find((message) => message.role === 'user')?.content ?? '';
  return (JSON.parse(user.slice(user.indexOf('{'))) as { alerts: Array<Record<string, unknown>> }).alerts;
}

const fromTemplate = (id: string) => ({ ...templateAlert(request(id)), aiGenerated: false, aiModel: null });

describe('AlertWriter', () => {
  it('writes template text without an API key, and makes no LLM call', async () => {
    const writer = new AlertWriter({ apiKey: undefined, model: 'test-model', timeoutMs: 1_000, batchSize: 20 });
    const { texts, stats } = await writer.write([request('1')]);
    expect(writer.mode).toBe('template');
    expect(stats).toMatchObject({ mode: 'template', calls: 0, fallbacks: 0 });
    expect(texts.get('1')).toEqual(fromTemplate('1'));
  });

  it('uses the LLM text when the call succeeds', async () => {
    const { writer } = writerWith(() => completion([aiText('1'), aiText('2')]));
    const { texts, stats } = await writer.write([request('1'), request('2')]);
    const { id: _id, ...text } = aiText('1');
    expect(texts.get('1')).toEqual({ ...text, aiGenerated: true, aiModel: 'test-model' });
    expect(stats).toEqual({ mode: 'ai', calls: 1, fallbacks: 0, tokens: 150, latencyMs: expect.any(Number) });
  });

  it('asks for strict structured output at temperature 0.2', async () => {
    const { writer, parse } = writerWith(() => completion([aiText('1')]));
    await writer.write([request('1')]);
    expect(parse.mock.calls[0]?.[0]).toMatchObject({
      model: 'test-model',
      temperature: 0.2,
      response_format: { type: 'json_schema', json_schema: { name: 'alert_texts', strict: true } },
    });
  });

  it('sends only the alert facts, never raw input', async () => {
    const { writer, parse } = writerWith(() => completion([aiText('1')]));
    await writer.write([request('1')]);
    const [sent] = sentAlerts(parse.mock.calls[0]?.[0]);
    expect(Object.keys(sent ?? {})).toEqual(['id', 'apiName', 'severity', 'occurrences', 'issues', 'metrics', 'thresholds']);
  });

  it('makes one call per chunk of batchSize alerts', async () => {
    const { writer, parse } = writerWith((body) => completion(sentAlerts(body).map((alert) => aiText(String(alert.id)))), 2);
    const { stats } = await writer.write(['1', '2', '3', '4', '5'].map(request));
    expect(parse).toHaveBeenCalledTimes(3);
    expect(stats).toMatchObject({ calls: 3, fallbacks: 0 });
  });

  it('falls back to templates for every alert when the call throws', async () => {
    const { writer } = writerWith(() => {
      throw new Error('Connection timed out');
    });
    const { texts, stats } = await writer.write([request('1'), request('2')]);
    expect(stats).toMatchObject({ mode: 'ai', calls: 1, fallbacks: 2 });
    expect(texts.get('1')).toEqual(fromTemplate('1'));
    expect(texts.get('2')).toEqual(fromTemplate('2'));
  });

  it('falls back when the model refuses or returns nothing', async () => {
    const { writer } = writerWith(() => completion(null, "I can't help with that."));
    const { texts, stats } = await writer.write([request('1')]);
    expect(stats.fallbacks).toBe(1);
    expect(texts.get('1')).toEqual(fromTemplate('1'));
  });

  it('falls back only for the alerts missing from the answer', async () => {
    const { writer } = writerWith(() => completion([aiText('1')]));
    const { texts, stats } = await writer.write([request('1'), request('2')]);
    expect(texts.get('1')?.aiGenerated).toBe(true);
    expect(texts.get('2')).toEqual(fromTemplate('2'));
    expect(stats.fallbacks).toBe(1);
  });

  it('rejects malformed items and ignores ids it did not ask for', async () => {
    const { writer } = writerWith(() =>
      completion([
        { ...aiText('1'), title: '   ' },
        { ...aiText('2'), title: 'far too many words in this title to be a usable alert title at all' },
        { ...aiText('3'), message: 'x'.repeat(700) },
        aiText('not-requested'),
        aiText('4'),
      ]),
    );
    const { texts, stats } = await writer.write(['1', '2', '3', '4'].map(request));
    expect(['1', '2', '3', '4'].map((id) => texts.get(id)?.aiGenerated)).toEqual([false, false, false, true]);
    expect(texts.has('not-requested')).toBe(false);
    expect(stats.fallbacks).toBe(3);
  });

  it('keeps the first answer when an id appears twice, and trims the text', async () => {
    const { writer } = writerWith(() => completion([{ ...aiText('1'), title: '  API1 is failing  ' }, { ...aiText('1'), title: 'Second' }]));
    const { texts } = await writer.write([request('1')]);
    expect(texts.get('1')?.title).toBe('API1 is failing');
  });
});
