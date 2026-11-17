import { describe, expect, it } from 'vitest';
import { buildDependencyGraph } from './graph';
import type { TerraformAnalysis } from './index';

function analysis(overrides: Partial<TerraformAnalysis> = {}): TerraformAnalysis {
  return {
    filesAnalyzed: ['main.tf'],
    resources: [
      { path: 'main.tf', line: 1, address: 'aws_vpc.main', type: 'aws_vpc', name: 'main', attributes: {} },
      { path: 'main.tf', line: 5, address: 'aws_subnet.app', type: 'aws_subnet', name: 'app', attributes: {} },
    ],
    modules: [],
    dataSources: [],
    variables: [],
    outputs: [],
    dependencies: [],
    unsupported: [],
    hardcodedValues: [],
    externalPrerequisites: [],
    diagnostics: [],
    ...overrides,
  };
}

describe('buildDependencyGraph', () => {
  it('creates stable nodes and directed dependent-to-prerequisite edges', () => {
    const graph = buildDependencyGraph(analysis({
      dependencies: [{
        from: 'aws_subnet.app',
        to: 'aws_vpc.main',
        kind: 'reference',
        path: 'main.tf',
        line: 5,
      }],
    }));

    expect(graph.nodes.map((node) => node.id)).toEqual(['aws_subnet.app', 'aws_vpc.main']);
    expect(graph.edges).toEqual([
      expect.objectContaining({ from: 'aws_subnet.app', to: 'aws_vpc.main', kind: 'reference' }),
    ]);
    expect(graph.unresolved).toEqual([]);
    expect(graph.externalInputs).toEqual([]);
  });

  it('keeps unresolved dependencies visible instead of treating them as resolved', () => {
    const graph = buildDependencyGraph(analysis({
      dependencies: [{
        from: 'aws_subnet.app',
        to: 'aws_vpc.missing',
        kind: 'reference',
        path: 'main.tf',
        line: 5,
      }],
    }));

    expect(graph.edges).toEqual([]);
    expect(graph.unresolved).toEqual(['aws_vpc.missing']);
  });

  it('classifies Terraform variables as external inputs, not unresolved resources', () => {
    const graph = buildDependencyGraph(analysis({
      dependencies: [{
        from: 'aws_subnet.app',
        to: 'var.vpc_cidr',
        kind: 'variable-reference',
        path: 'main.tf',
        line: 5,
      }],
    }));

    expect(graph.unresolved).toEqual([]);
    expect(graph.externalInputs).toEqual(['var.vpc_cidr']);
  });

  it('reports dependency cycles', () => {
    const graph = buildDependencyGraph(analysis({
      dependencies: [
        { from: 'aws_subnet.app', to: 'aws_vpc.main', kind: 'reference', path: 'main.tf', line: 5 },
        { from: 'aws_vpc.main', to: 'aws_subnet.app', kind: 'reference', path: 'main.tf', line: 1 },
      ],
    }));

    expect(graph.cycles).toEqual([['aws_subnet.app', 'aws_vpc.main', 'aws_subnet.app']]);
  });
});
