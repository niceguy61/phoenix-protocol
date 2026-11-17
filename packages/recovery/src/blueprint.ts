import { BlueprintSchema, type BlueprintStep, type Finding } from '@phoenix/contracts';
import type { DependencyGraph, GraphNode } from '@phoenix/analyzer';

export interface BlueprintOptions {
  requiredInputs?: string[];
  verificationPlan?: string[];
}

export class BlueprintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlueprintError';
  }
}

export function createRecoveryBlueprint(
  graph: DependencyGraph,
  findings: Finding[],
  options: BlueprintOptions = {},
) {
  if (graph.cycles.length > 0) {
    throw new BlueprintError(`Cannot create an executable blueprint from a cyclic graph: ${graph.cycles[0].join(' -> ')}`);
  }

  const orderedNodes = topologicalPrerequisiteOrder(graph);
  const steps: BlueprintStep[] = [
    {
      id: 'validate',
      kind: 'terraform-validate',
      dependsOn: [],
      requiredInputs: [],
      expectedOutcome: 'Terraform configuration validates without syntax errors.',
      approvalRequired: false,
    },
  ];
  const stepIds = new Map<string, string>();

  for (const node of orderedNodes) {
    const stepId = `node-${node.id}`;
    stepIds.set(node.id, stepId);
    steps.push({
      id: stepId,
      kind: node.kind === 'data-source' ? 'external-prerequisite-check' : 'resource-prerequisite',
      dependsOn: [
        'validate',
        ...graph.edges
          .filter((edge) => edge.from === node.id)
          .map((edge) => stepIds.get(edge.to))
          .filter((value): value is string => Boolean(value)),
      ],
      requiredInputs: [],
      expectedOutcome: expectedOutcome(node),
      approvalRequired: false,
    });
  }

  steps.push({
    id: 'terraform-apply',
    kind: 'terraform-apply',
    dependsOn: orderedNodes.map((node) => stepIds.get(node.id)).filter((value): value is string => Boolean(value)),
    requiredInputs: [...new Set(options.requiredInputs ?? [])].sort(),
    expectedOutcome: 'Terraform apply completes in the approved recovery target.',
    approvalRequired: true,
  });

  const externalDependencies = [
    ...graph.unresolved,
    ...findings
      .filter((finding) => finding.category === 'external-prerequisite')
      .map((finding) => finding.summary),
  ].sort();
  const blueprint = {
    steps,
    externalDependencies: [...new Set(externalDependencies)],
    estimatedDurationSeconds: 30 + orderedNodes.length * 10,
    verificationPlan: [...new Set(options.verificationPlan ?? ['terraform-apply'])],
  };

  const parsed = BlueprintSchema.safeParse(blueprint);
  if (!parsed.success) throw new BlueprintError('Generated blueprint failed its contract');
  return parsed.data;
}

function topologicalPrerequisiteOrder(graph: DependencyGraph): GraphNode[] {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const visited = new Set<string>();
  const ordered: GraphNode[] = [];

  const visit = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    for (const edge of graph.edges.filter((candidate) => candidate.from === nodeId)) {
      visit(edge.to);
    }
    const node = nodes.get(nodeId);
    if (node) ordered.push(node);
  };

  for (const node of [...nodes.keys()].sort()) visit(node);
  return ordered;
}

function expectedOutcome(node: GraphNode): string {
  if (node.kind === 'data-source') return `${node.id} is available in the recovery target.`;
  if (node.kind === 'module') return `${node.id} prerequisites are resolved.`;
  return `${node.id} can be provisioned in the approved recovery target.`;
}
