import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  NvidiaNimClient,
  NimInvalidResponseError,
  redactSensitive,
} from './index';

const resultSchema = z.object({ answer: z.string() });

function response(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('NvidiaNimClient', () => {
  it('calls the configured managed endpoint and validates JSON output', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({ choices: [{ message: { content: '{"answer":"grounded"}' } }] }),
    );
    const client = new NvidiaNimClient({
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      model: 'z-ai/glm-5.3-flash',
      apiKey: 'test-key',
      fetchImpl,
    });

    const result = await client.completeJson({
      promptVersion: 'test-v1',
      system: 'Return JSON only.',
      user: 'Use the evidence.',
      schema: resultSchema,
    });

    expect(result.data).toEqual({ answer: 'grounded' });
    expect(result.metadata.model).toBe('z-ai/glm-5.3-flash');
    expect(result.metadata.promptVersion).toBe('test-v1');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    );
  });

  it('rejects malformed or schema-invalid model output', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({ choices: [{ message: { content: '{"unexpected":true}' } }] }),
    );
    const client = new NvidiaNimClient({
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      model: 'z-ai/glm-5.3-flash',
      apiKey: 'test-key',
      fetchImpl,
    });

    await expect(
      client.completeJson({
        promptVersion: 'test-v1',
        user: 'Return the result.',
        schema: resultSchema,
      }),
    ).rejects.toBeInstanceOf(NimInvalidResponseError);
  });

  it('loads the managed endpoint and model defaults from server environment values', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({ choices: [{ message: { content: '{"answer":"configured"}' } }] }),
    );
    const client = NvidiaNimClient.fromEnv(
      { NVIDIA_API_KEY: 'server-key' },
      { fetchImpl },
    );

    await client.completeJson({
      promptVersion: 'env-v1',
      user: 'Return the result.',
      schema: resultSchema,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('z-ai/glm-5.3-flash'),
      }),
    );
  });

  it('redacts credential-like values before they reach logs', () => {
    expect(redactSensitive('token=abc password=secret Authorization: Bearer xyz')).toBe(
      'token=[REDACTED] password=[REDACTED] Authorization: Bearer [REDACTED]',
    );
  });
});
