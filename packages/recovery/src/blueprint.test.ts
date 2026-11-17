import { describe, expect, it } from 'vitest';
import type { Finding } from '@phoenix/contracts';
import type { DependencyGraph } from '@phoenix/analyzer';
import { createRecoveryBlueprint, BlueprintError } from './blueprint';

function graph(overrides: Partial<DependencyGraph> = {}): DependencyGraph {
  return {
    nodes: [
      { id: 'aws_subnet.app', kind: 'resource', service: 'subnet', status: 'resolved' },
      { id: 'aws_vpc.main', kind: 'resource', service: 'vpc', status: 'resolved' },
    ],
    edges: [{
      from: 'aws_subnet.app',
      to: 'aws_vpc.main',
      kind: 'reference',
      path: 'main.tf',
      line: 5,
    }],
    unresolved: [],
    externalInputs: [],
    cycles: [],
    ...overrides,
  };
}

function finding(category: Finding['category'], summary: string): Finding {
  return {
    id: `risk-${category}`,
    severity: 'high',
    status: 'verified',
    category,
    evidence: [{
      sourceType: 'terraform',
      locator: 'main.tf:5',
      sessionId: 'session-1',
      observedAt: '2026-11-17T00:00:00.000Z',
    }],
    summary,
    recommendedAction: 'Resolve before recovery',
  };
}

describe('createRecoveryBlueprint', () => {
  it('orders prerequisites before dependents and requires approval for apply', () => {
    const blueprint = createRecoveryBlueprint(graph(), [], {
      requiredInputs: ['var.environment'],
      verificationPlan: ['http-health'],
    });

    expect(blueprint.steps.map((step) => step.id)).toEqual([
      'validate',
      'node-aws_vpc.main',
      'node-aws_subnet.app',
      'terraform-apply',
    ]);
    expect(blueprint.steps[2].dependsOn).toEqual(['validate', 'node-aws_vpc.main']);
    expect(blueprint.steps.at(-1)).toEqual(expect.objectContaining({
      id: 'terraform-apply',
      approvalRequired: true,
      requiredInputs: ['var.environment'],
    }));
  });

  it('preserves unresolved and external prerequisites', () => {
    const blueprint = createRecoveryBlueprint(
      graph({ unresolved: ['aws_kms_key.missing'] }),
      [finding('external-prerequisite', 'Certificate is external')],
    );

    expect(blueprint.externalDependencies).toEqual([
      'Certificate is external',
      'aws_kms_key.missing',
    ]);
  });

  it('rejects cyclic graphs before producing an executable plan', () => {
    expect(() => createRecoveryBlueprint(graph({
      cycles: [['aws_subnet.app', 'aws_vpc.main', 'aws_subnet.app']],
    }), [])).toThrow(BlueprintError);
  });
});
