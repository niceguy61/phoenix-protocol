import { describe, expect, it } from 'vitest';
import {
  BlueprintSchema,
  EvidenceRefSchema,
  EvidenceReportSchema,
  ExecutionSessionSchema,
  FindingSchema,
  GraphSchema,
  NimStructuredResponseSchema,
  SourceSnapshotSchema,
  VerificationCheckSchema,
} from './index';

describe('shared contracts', () => {
  it('accepts evidence with a source locator and observation timestamp', () => {
    const result = EvidenceRefSchema.safeParse({
      sourceType: 'terraform',
      locator: 'main.tf:12',
      sessionId: 'session-1',
      observedAt: '2026-11-17T00:00:00.000Z',
    });

    expect(result.success).toBe(true);
  });

  it('rejects findings without evidence', () => {
    const result = FindingSchema.safeParse({
      id: 'risk-1',
      severity: 'high',
      status: 'verified',
      category: 'missing-variable',
      summary: 'A variable is missing',
      recommendedAction: 'Provide the variable',
      evidence: [],
    });

    expect(result.success).toBe(false);
  });

  it('accepts an execution session with explicit mode and lifecycle state', () => {
    const result = ExecutionSessionSchema.safeParse({
      sessionId: 'session-1',
      mode: 'mock',
      status: 'awaiting-approval',
      commitSha: '0123456789abcdef0123456789abcdef01234567',
      createdAt: '2026-11-17T00:00:00.000Z',
      updatedAt: '2026-11-17T00:00:00.000Z',
    });

    expect(result.success).toBe(true);
  });
  it('accepts an immutable source snapshot and dependency graph', () => {
    const snapshot = SourceSnapshotSchema.safeParse({
      repository: 'owner/repo',
      ref: 'main',
      commitSha: '0123456789abcdef0123456789abcdef01234567',
      terraformRoot: 'infra',
      snapshotId: 'snapshot-1',
    });
    const graph = GraphSchema.safeParse({
      nodes: [{ id: 'aws_vpc.main', kind: 'resource', status: 'resolved' }],
      edges: [],
      unresolved: [],
    });

    expect(snapshot.success).toBe(true);
    expect(graph.success).toBe(true);
  });

  it('preserves invalid verification and blueprint states instead of normalizing them', () => {
    const check = VerificationCheckSchema.safeParse({
      id: 'http-health',
      layer: 'application',
      required: true,
      status: 'unverified',
      startedAt: '2026-11-17T00:00:00.000Z',
      evidence: [],
      message: 'No execution evidence',
    });
    const blueprint = BlueprintSchema.safeParse({
      steps: [{
        id: 'step-1',
        kind: 'terraform-validate',
        dependsOn: [],
        requiredInputs: [],
        expectedOutcome: 'Validation completes',
        approvalRequired: false,
      }],
      externalDependencies: [],
      estimatedDurationSeconds: 10,
      verificationPlan: ['http-health'],
    });

    expect(check.success).toBe(true);
    expect(blueprint.success).toBe(true);
  });

  it('requires report status and evidence references', () => {
    const report = EvidenceReportSchema.safeParse({
      sessionId: 'session-1',
      status: 'unverified',
      source: {
        repository: 'owner/repo',
        commitSha: '0123456789abcdef0123456789abcdef01234567',
      },
      evidenceRefs: [],
      generatedAt: '2026-11-17T00:00:00.000Z',
    });

    expect(report.success).toBe(false);
  });
  it('keeps model recommendations separate from verified facts', () => {
    const result = NimStructuredResponseSchema.safeParse({
      facts: ['main.tf declares an ECS service'],
      assumptions: ['The image may not be available'],
      recommendations: ['Add an image availability check'],
      needsEvidence: [],
    });

    expect(result.success).toBe(true);
  });
});
