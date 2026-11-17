import { z } from 'zod';

export const EvidenceSourceTypeSchema = z.enum([
  'repository',
  'terraform',
  'execution-log',
  'aws-observation',
  'verification',
  'model',
]);

export const EvidenceRefSchema = z.object({
  sourceType: EvidenceSourceTypeSchema,
  locator: z.string().min(1),
  sessionId: z.string().min(1),
  observedAt: z.string().datetime(),
  contentHash: z.string().optional(),
});

export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export const EvidenceStatusSchema = z.enum([
  'verified',
  'inferred',
  'assumption',
  'recommendation',
  'needs-evidence',
]);

export const FindingSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  status: z.enum(['verified', 'inferred', 'needs-evidence', 'resolved']),
  category: z.string().min(1),
  evidence: z.array(EvidenceRefSchema).min(1),
  summary: z.string().min(1),
  recommendedAction: z.string().min(1),
});

export type Finding = z.infer<typeof FindingSchema>;

export const SourceSnapshotSchema = z.object({
  repository: z.string().min(1),
  ref: z.string().min(1),
  commitSha: z.string().regex(/^[a-f0-9]{40}$/),
  terraformRoot: z.string().min(1),
  snapshotId: z.string().min(1),
});

export const GraphNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['resource', 'module', 'data-source']),
  status: z.enum(['resolved', 'unresolved', 'external']),
  service: z.string().optional(),
});

export const GraphEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  kind: z.enum(['reference', 'depends-on', 'module', 'external']),
});

export const GraphSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  unresolved: z.array(z.string()),
  cycles: z.array(z.array(z.string())),
});

export const BlueprintStepSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  dependsOn: z.array(z.string()),
  requiredInputs: z.array(z.string()),
  expectedOutcome: z.string().min(1),
  approvalRequired: z.boolean(),
});

export type BlueprintStep = z.infer<typeof BlueprintStepSchema>;

export const BlueprintSchema = z.object({
  steps: z.array(BlueprintStepSchema),
  externalDependencies: z.array(z.string()),
  estimatedDurationSeconds: z.number().nonnegative(),
  verificationPlan: z.array(z.string()),
});

export const ExecutionSessionSchema = z.object({
  sessionId: z.string().min(1),
  mode: z.enum(['mock', 'aws-sandbox']),
  status: z.enum([
    'created',
    'awaiting-approval',
    'approved',
    'running',
    'verifying',
    'completed',
    'failed',
    'cleanup-pending',
    'cleaned',
    'cleanup-failed',
  ]),
  commitSha: z.string().regex(/^[a-f0-9]{40}$/),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const VerificationCheckSchema = z.object({
  id: z.string().min(1),
  layer: z.enum(['infrastructure', 'application']),
  required: z.boolean(),
  status: z.enum(['passed', 'failed', 'skipped', 'unverified']),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  evidence: z.array(EvidenceRefSchema),
  message: z.string().min(1),
});

export const EvidenceReportSchema = z.object({
  sessionId: z.string().min(1),
  status: z.enum(['recovery-verified', 'failed', 'unverified']),
  source: z.object({
    repository: z.string().min(1),
    commitSha: z.string().regex(/^[a-f0-9]{40}$/),
  }),
  evidenceRefs: z.array(EvidenceRefSchema).min(1),
  generatedAt: z.string().datetime(),
});
export const NimStructuredResponseSchema = z.object({
  facts: z.array(z.string()),
  assumptions: z.array(z.string()),
  recommendations: z.array(z.string()),
  needsEvidence: z.array(z.string()),
});

export type NimStructuredResponse = z.infer<typeof NimStructuredResponseSchema>;
