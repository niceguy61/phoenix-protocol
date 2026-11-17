import { describe, expect, it, vi } from 'vitest';
import type { CompleteJsonResult } from '@phoenix/ai-provider';
import { NimStructuredResponseSchema } from '@phoenix/contracts';
import type { TerraformAnalysis } from '@phoenix/analyzer';
import { analyzeRecoveryRisks } from './risk';

function analysis(overrides: Partial<TerraformAnalysis> = {}): TerraformAnalysis {
  return {
    filesAnalyzed: ['main.tf'],
    resources: [{
      path: 'main.tf',
      line: 1,
      address: 'aws_instance.app',
      type: 'aws_instance',
      name: 'app',
      attributes: {},
    }],
    modules: [],
    dataSources: [],
    variables: ['environment'],
    outputs: [],
    dependencies: [{
      from: 'aws_instance.app',
      to: 'var.missing',
      kind: 'variable-reference',
      path: 'main.tf',
      line: 1,
    }],
    unsupported: [{
      path: 'main.tf',
      line: 20,
      kind: 'resource',
      type: 'aws_neptune_cluster',
      name: 'database',
      reason: 'Not supported yet',
    }],
    hardcodedValues: [{
      path: 'main.tf',
      line: 1,
      severity: 'warning',
      code: 'HARD_CODED_VALUE',
      message: 'AMI ID is hardcoded',
    }],
    externalPrerequisites: [],
    diagnostics: [],
    ...overrides,
  };
}

describe('analyzeRecoveryRisks', () => {
  it('creates evidence-backed deterministic findings', async () => {
    const result = await analyzeRecoveryRisks(analysis(), {
      sessionId: 'session-1',
      observedAt: '2026-11-17T00:00:00.000Z',
    });

    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'unsupported-resource', status: 'verified' }),
      expect.objectContaining({ category: 'missing-variable', status: 'verified' }),
      expect.objectContaining({ category: 'hardcoded-value', status: 'verified' }),
    ]));
    expect(result.findings.every((finding) => finding.evidence.length > 0)).toBe(true);
    expect(result.aiAdvisory).toBeUndefined();
  });

  it('keeps deterministic findings when NIM is unavailable', async () => {
    const result = await analyzeRecoveryRisks(analysis(), {
      sessionId: 'session-1',
      observedAt: '2026-11-17T00:00:00.000Z',
      aiClient: {
        completeJson: vi.fn().mockRejectedValue(new Error('NIM unavailable')),
      },
    });

    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.aiAdvisory).toBeUndefined();
    expect(result.diagnostics).toContain('AI advisory unavailable');
  });

  it('keeps NIM output as an inferred advisory, never a verified finding', async () => {
    const aiResponse: CompleteJsonResult<unknown> = {
      data: {
        facts: ['The input contains an unsupported resource'],
        assumptions: ['The replacement service may be available'],
        recommendations: ['Add a supported replacement or adapter'],
        needsEvidence: ['Confirm service availability in the target region'],
      },
      metadata: {
        model: 'z-ai/glm-5.3-flash',
        promptVersion: 'risk-v1',
        requestId: 'request-1',
        latencyMs: 10,
        responseHash: 'a'.repeat(64),
      },
    };
    const completeJson = vi.fn().mockResolvedValue(aiResponse);

    const result = await analyzeRecoveryRisks(analysis(), {
      sessionId: 'session-1',
      observedAt: '2026-11-17T00:00:00.000Z',
      aiClient: { completeJson },
    });

    expect(result.aiAdvisory?.status).toBe('inferred');
    expect(NimStructuredResponseSchema.safeParse(result.aiAdvisory?.data).success).toBe(true);
    expect(result.findings.every((finding) => finding.status !== 'inferred')).toBe(true);
    expect(completeJson).toHaveBeenCalledWith(expect.objectContaining({ promptVersion: 'risk-v1' }));
  });
});
