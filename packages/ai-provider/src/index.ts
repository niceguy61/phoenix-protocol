import { z } from 'zod';

export interface NimMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface NimClientOptions {
  baseUrl: string;
  model: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface CompleteJsonInput<T> {
  promptVersion: string;
  system?: string;
  user: string;
  schema: z.ZodType<T>;
  temperature?: number;
  maxTokens?: number;
}

export interface NimMetadata {
  model: string;
  promptVersion: string;
  requestId: string;
  latencyMs: number;
  responseHash: string;
}

export interface CompleteJsonResult<T> {
  data: T;
  metadata: NimMetadata;
}

export class NimRequestError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'NimRequestError';
  }
}

export class NimInvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NimInvalidResponseError';
  }
}

export const redactSensitive = (value: string): string =>
  value
    .replace(/(authorization\s*:\s*bearer\s+)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/(\b(?:token|password|secret|api[_-]?key)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]');

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const hashResponse = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export class NvidiaNimClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly endpoint: string;

  static fromEnv(
    env: Record<string, string | undefined> = process.env,
    overrides: Partial<Omit<NimClientOptions, 'baseUrl' | 'model' | 'apiKey'>> = {},
  ): NvidiaNimClient {
    return new NvidiaNimClient({
      baseUrl: env.NVIDIA_BASE_URL ?? 'https://integrate.api.nvidia.com/v1',
      model: env.NVIDIA_MODEL ?? 'z-ai/glm-5.3-flash',
      apiKey: env.NVIDIA_API_KEY ?? '',
      ...overrides,
    });
  }

  constructor(private readonly options: NimClientOptions) {
    if (!options.apiKey) {
      throw new Error('NVIDIA_API_KEY is required on the server');
    }

    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 250;
    this.sleep = options.sleep ?? wait;
    this.endpoint = `${options.baseUrl.replace(/\/$/, '')}/chat/completions`;
  }

  async completeJson<T>(input: CompleteJsonInput<T>): Promise<CompleteJsonResult<T>> {
    const messages: NimMessage[] = [];
    if (input.system) messages.push({ role: 'system', content: input.system });
    messages.push({ role: 'user', content: input.user });

    const body = JSON.stringify({
      model: this.options.model,
      messages,
      temperature: input.temperature ?? 0,
      max_tokens: input.maxTokens ?? 128,
      response_format: { type: 'json_object' },
      chat_template_kwargs: { reasoning_effort: 'low', clear_thinking: true },
    });
    const startedAt = Date.now();
    let lastError: NimRequestError | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchImpl(this.endpoint, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.options.apiKey}`,
          },
          body,
          signal: controller.signal,
        });

        const responseText = await response.text();
        if (!response.ok) {
          const error = new NimRequestError(
            `NVIDIA NIM request failed: ${redactSensitive(responseText).slice(0, 500)}`,
            response.status,
          );
          if (!this.isRetryable(response.status) || attempt === this.maxRetries) throw error;
          lastError = error;
          await this.sleep(this.retryDelayMs * 2 ** attempt);
          continue;
        }

        let payload: unknown;
        try {
          payload = JSON.parse(responseText);
        } catch {
          throw new NimInvalidResponseError('NVIDIA NIM returned invalid JSON');
        }

        const content = this.extractContent(payload);
        let modelJson: unknown;
        try {
          modelJson = JSON.parse(content);
        } catch {
          throw new NimInvalidResponseError('NVIDIA NIM content was not valid JSON');
        }

        const parsed = input.schema.safeParse(modelJson);
        if (!parsed.success) {
          throw new NimInvalidResponseError('NVIDIA NIM JSON failed the response schema');
        }

        return {
          data: parsed.data,
          metadata: {
            model: this.options.model,
            promptVersion: input.promptVersion,
            requestId: this.requestId(response.headers),
            latencyMs: Date.now() - startedAt,
            responseHash: await hashResponse(content),
          },
        };
      } catch (error) {
        if (error instanceof NimRequestError || error instanceof NimInvalidResponseError) throw error;
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new NimRequestError('NVIDIA NIM request timed out');
        }
        throw new NimRequestError('NVIDIA NIM request failed without exposing the underlying error');
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new NimRequestError('NVIDIA NIM request failed');
  }

  private isRetryable(status: number): boolean {
    return status === 429 || status >= 500;
  }

  private requestId(headers: Headers): string {
    return headers.get('x-request-id') ?? headers.get('request-id') ?? 'unavailable';
  }

  private extractContent(payload: unknown): string {
    if (!payload || typeof payload !== 'object' || !('choices' in payload)) {
      throw new NimInvalidResponseError('NVIDIA NIM response did not contain choices');
    }
    const choices = (payload as { choices?: unknown }).choices;
    if (!Array.isArray(choices) || choices.length === 0) {
      throw new NimInvalidResponseError('NVIDIA NIM response contained no choices');
    }
    const message = choices[0];
    if (!message || typeof message !== 'object' || !('message' in message)) {
      throw new NimInvalidResponseError('NVIDIA NIM response did not contain a message');
    }
    const content = (message as { message?: { content?: unknown } }).message?.content;
    if (typeof content !== 'string') {
      throw new NimInvalidResponseError('NVIDIA NIM message content was not text');
    }
    return content;
  }
}

export * from './evaluation';
