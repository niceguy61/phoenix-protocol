import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { NvidiaNimClient } from '../../packages/ai-provider/src/index';

const liveEnabled = process.env.NVIDIA_LIVE_TEST === '1';
const resultSchema = z.object({
  ok: z.boolean(),
  summary: z.string().min(1),
});

describe.skipIf(!liveEnabled)('managed NVIDIA NIM smoke test', () => {
  it('returns schema-valid JSON without exposing credentials', async () => {
    const client = NvidiaNimClient.fromEnv(undefined, { timeoutMs: 120_000 });
    const result = await client.completeJson({
      promptVersion: 'live-smoke-v1',
      system: 'Return only JSON matching the requested schema.',
      user: 'Return ok=true and a short summary that says the Phoenix Protocol NIM smoke test responded.',
      schema: resultSchema,
      temperature: 0,
      maxTokens: 128,
    });

    expect(result.data.ok).toBe(true);
    expect(result.data.summary).toContain('Phoenix Protocol');
    expect(result.metadata.model).toBe(process.env.NVIDIA_MODEL ?? 'z-ai/glm-5.3-flash');
    expect(result.metadata.responseHash).toMatch(/^[a-f0-9]{64}$/);
  }, 150_000);
});
