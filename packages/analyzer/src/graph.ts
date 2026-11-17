import type { TerraformAnalysis, TerraformDependency } from './index';

export interface GraphNode {
  id: string;
  kind: 'resource' | 'module' | 'data-source';
  service?: string;
  status: 'resolved' | 'unresolved' | 'external';
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: TerraformDependency['kind'];
  path: string;
  line: number;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  unresolved: string[];
  externalInputs: string[];
  cycles: string[][];
}

export function buildDependencyGraph(analysis: TerraformAnalysis): DependencyGraph {
  const nodes = [
    ...analysis.resources.map((resource): GraphNode => ({
      id: resource.address,
      kind: 'resource',
      service: resource.type.replace(/^aws_/, ''),
      status: 'resolved',
    })),
    ...analysis.modules.map((name): GraphNode => ({
      id: `module.${name}`,
      kind: 'module',
      status: 'resolved',
    })),
    ...analysis.dataSources.map((address): GraphNode => ({
      id: `data.${address}`,
      kind: 'data-source',
      status: 'external',
    })),
  ].sort((left, right) => left.id.localeCompare(right.id));

  const nodeIds = new Set(nodes.map((node) => node.id));
  const unresolved = new Set<string>();
  const externalInputs = new Set<string>();
  const edges: GraphEdge[] = [];

  for (const dependency of analysis.dependencies) {
    if (!nodeIds.has(dependency.from)) continue;
    if (dependency.to.startsWith('var.')) {
      externalInputs.add(dependency.to);
      continue;
    }
    if (!nodeIds.has(dependency.to)) {
      unresolved.add(dependency.to);
      continue;
    }
    edges.push({ ...dependency });
  }

  edges.sort((left, right) =>
    `${left.from}|${left.to}|${left.kind}`.localeCompare(`${right.from}|${right.to}|${right.kind}`),
  );

  return {
    nodes,
    edges: uniqueEdges(edges),
    unresolved: [...unresolved].sort(),
    externalInputs: [...externalInputs].sort(),
    cycles: findCycles(nodes.map((node) => node.id), edges),
  };
}

function uniqueEdges(edges: GraphEdge[]): GraphEdge[] {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    const key = `${edge.from}|${edge.to}|${edge.kind}|${edge.path}|${edge.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findCycles(nodeIds: string[], edges: GraphEdge[]): string[][] {
  const adjacency = new Map<string, string[]>();
  for (const nodeId of nodeIds) adjacency.set(nodeId, []);
  for (const edge of edges) adjacency.get(edge.from)?.push(edge.to);

  const cycles: string[][] = [];
  const seen = new Set<string>();
  const visit = (node: string, path: string[]) => {
    const index = path.indexOf(node);
    if (index !== -1) {
      const cycle = [...path.slice(index), node];
      const key = canonicalCycle(cycle);
      if (!seen.has(key)) {
        seen.add(key);
        cycles.push(cycle);
      }
      return;
    }
    for (const next of adjacency.get(node) ?? []) visit(next, [...path, node]);
  };

  for (const nodeId of nodeIds) visit(nodeId, []);
  return cycles.sort((left, right) => left.join('|').localeCompare(right.join('|')));
}

function canonicalCycle(cycle: string[]): string {
  const values = cycle.slice(0, -1);
  const rotations = values.map((_, index) => [
    ...values.slice(index),
    ...values.slice(0, index),
  ]);
  return rotations.map((rotation) => rotation.join('|')).sort()[0] ?? '';
}
