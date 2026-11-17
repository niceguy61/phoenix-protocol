import { describe, expect, it } from 'vitest';
import type { Finding } from '@phoenix/contracts';
import type { DependencyGraph } from '@phoenix/analyzer';
import { generateEvidenceReport } from './report';

const graph: DependencyGraph = { nodes: [], edges: [], unresolved: [], externalInputs: [], cycles: [] };
const finding: Finding = {
  id: 'risk-1',
  severity: 'high',
  status: 'verified',
  category: 'external-prerequisite',
  evidence: [{ sourceType: 'terraform', locator: 'main.tf:1', sessionId: 'session-1', observedAt: '2026-11-17T00:00:00.000Z' }],
  summary: 'Certificate is external',
  recommendedAction: 'Verify the certificate',
};

const baseInput = {
  sessionId: 'session-1',
  repository: 'niceguy61/phoenix-protocol',
  commitSha: '0123456789abcdef0123456789abcdef01234567',
  graph,
  findings: [finding],
  blueprint: { steps: [], externalDependencies: [], estimatedDurationSeconds: 30, verificationPlan: ['http-health'] },
  execution: {
    sessionId: 'session-1', mode: 'mock' as const, status: 'verifying' as const,
    commitSha: '0123456789abcdef0123456789abcdef01234567',
    createdAt: '2026-11-17T00:00:00.000Z', updatedAt: '2026-11-17T00:00:01.000Z',
  },
  evidenceRefs: [{ sourceType: 'verification' as const, locator: 'http-health', sessionId: 'session-1', observedAt: '2026-11-17T00:00:01.000Z' }],
  generatedAt: '2026-11-17T00:00:02.000Z',
  actualDurationSeconds: 1,
};

describe('generateEvidenceReport', () => {
  it('marks a report verified only from required verification evidence', () => {
    const report = generateEvidenceReport({
      ...baseInput,
      verification: {
        checks: [{ id: 'http-health', layer: 'application', required: true, status: 'passed', startedAt: '2026-11-17T00:00:00.000Z', completedAt: '2026-11-17T00:00:01.000Z', evidence: baseInput.evidenceRefs, message: 'HTTP 200' }],
        requiredPassed: 1, requiredTotal: 1, recoveryVerified: true,
      },
    });

    expect(report.report.status).toBe('recovery-verified');
    expect(report.json).toContain('Certificate is external');
    expect(report.html).toContain('recovery-verified');
  });

  it('keeps failed and skipped checks visible and does not claim success', () => {
    const report = generateEvidenceReport({
      ...baseInput,
      verification: {
        checks: [
          { id: 'terraform-apply', layer: 'infrastructure', required: true, status: 'passed', startedAt: '2026-11-17T00:00:00.000Z', completedAt: '2026-11-17T00:00:01.000Z', evidence: [], message: 'Apply completed' },
          { id: 'http-health', layer: 'application', required: true, status: 'failed', startedAt: '2026-11-17T00:00:00.000Z', completedAt: '2026-11-17T00:00:01.000Z', evidence: [], message: 'HTTP 503 <downstream>' },
          { id: 'database-connectivity', layer: 'application', required: false, status: 'skipped', startedAt: '2026-11-17T00:00:00.000Z', completedAt: '2026-11-17T00:00:01.000Z', evidence: [], message: 'Database not configured' },
        ],
        requiredPassed: 1, requiredTotal: 2, recoveryVerified: false,
      },
    });

    expect(report.report.status).toBe('failed');
    expect(report.html).toContain('HTTP 503 &lt;downstream&gt;');
    expect(report.json).toContain('"skipped"');
  });
});
