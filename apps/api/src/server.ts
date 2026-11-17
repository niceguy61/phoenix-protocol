import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { GitHubRepositoryClient, captureRepositoryChange, type RepositorySnapshot, type RepositorySourceFile } from '@phoenix/repository';
import { evaluateNimAdvisory, summarizeNimEvaluation } from '@phoenix/ai-provider';
import { analyzeTerraform, buildDependencyGraph, type TerraformAnalysis } from '@phoenix/analyzer';
import {
  analyzeRecoveryRisks,
  collectAwsInventory,
  compareTerraformToAws,
  createAwsSdkInventoryReader,
  createRecoveryBlueprint,
  generateEvidenceReport,
  MockRecoveryRunner,
  runVerification,
  type AwsInventoryReader,
  type RiskAnalysisResult,
  type VerificationResult,
} from '@phoenix/recovery';

const AwsProfileSchema = z.enum(['default', 'sandbox']);

type AwsProfile = z.infer<typeof AwsProfileSchema>;

const AnalysisInputSchema = z.object({
  repositoryUrl: z.string().url(),
  ref: z.string().min(1).max(256),
  terraformRoot: z.string().min(1).max(512),
  awsProfile: AwsProfileSchema.default('default'),
});

const ChangeAnalysisInputSchema = z.object({
  repositoryUrl: z.string().url(),
  baseRef: z.string().min(1).max(256),
  proposedRef: z.string().min(1).max(256),
  terraformRoot: z.string().min(1).max(512),
  awsProfile: AwsProfileSchema.default('default'),
  region: z.literal('ap-northeast-2').default('ap-northeast-2'),
});

const RecoveryCreateInputSchema = z.object({ analysisId: z.string().min(1) });


const RecoveryRunInputSchema = z.object({ scenario: z.enum(['success', 'plan-failure', 'apply-failure']).optional() });

type AnalysisRecord = {
  analysisId: string;
  status: 'analysis-complete';
  awsProfile: AwsProfile;
  snapshot: RepositorySnapshot;
  analysis: TerraformAnalysis;
  graph: ReturnType<typeof buildDependencyGraph>;
  risks: RiskAnalysisResult;
  blueprint: ReturnType<typeof createRecoveryBlueprint> | null;
  blueprintError?: string;
};

type RecoveryRecord = {
  sessionId: string;
  analysisId: string;
  session: ReturnType<MockRecoveryRunner['createSession']>;
  execution?: Awaited<ReturnType<MockRecoveryRunner['execute']>>;
  verification?: VerificationResult;
  report?: ReturnType<typeof generateEvidenceReport>;
};

export interface RepositoryClient {
  resolveSnapshot(input: {
    repositoryUrl: string;
    ref: string;
    terraformRoot: string;
  }): Promise<RepositorySnapshot>;
  getTerraformFiles?(snapshot: RepositorySnapshot): Promise<RepositorySourceFile[]>;
}

export interface ApiServerOptions {
  repositoryClient?: RepositoryClient;
  inventoryReader?: AwsInventoryReader;
}

export function createApiServer(options: ApiServerOptions = {}): Server {
  const repositoryClient = options.repositoryClient ?? new GitHubRepositoryClient();
  const inventoryReader = options.inventoryReader;
  const runner = new MockRecoveryRunner();
  const analyses = new Map<string, AnalysisRecord>();
  const recoveries = new Map<string, RecoveryRecord>();

  return createServer(async (request, response) => {
    try {
      await route(request, response, repositoryClient, inventoryReader, runner, analyses, recoveries);
    } catch (error) {
      sendJson(response, 500, {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Internal server error',
        },
      });
    }
  });
}

async function route(
  request: IncomingMessage,
  response: ServerResponse,
  repositoryClient: RepositoryClient,
  inventoryReader: AwsInventoryReader | undefined,
  runner: MockRecoveryRunner,
  analyses: Map<string, AnalysisRecord>,
  recoveries: Map<string, RecoveryRecord>,
): Promise<void> {
  const method = request.method ?? 'GET';
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  const origin = request.headers.origin;
  if (origin && [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3010',
    'http://127.0.0.1:3010',
  ].includes(origin)) {
    response.setHeader('access-control-allow-origin', origin);
    response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
    response.setHeader('access-control-allow-headers', 'content-type');
    response.setHeader('vary', 'Origin');
  }
  if (method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  if (method === 'GET' && path === '/api/health') {
    sendJson(response, 200, { status: 'ok' });
    return;
  }

  if (method === 'GET' && path === '/api/aws/profiles') {
    const sandboxEnabled = process.env.PHOENIX_AWS_SANDBOX_ENABLED === 'true';
    sendJson(response, 200, {
      profiles: [
        { name: 'default', status: 'configured' },
        { name: 'sandbox', status: sandboxEnabled ? 'configured' : 'disabled' },
      ],
    });
    return;
  }

  if (method === 'GET' && path === '/api/aws/inventory') {
    const query = new URL(request.url ?? '/', 'http://localhost').searchParams;
    const input = z.object({ profile: AwsProfileSchema.default('default'), region: z.literal('ap-northeast-2').default('ap-northeast-2') }).safeParse({ profile: query.get('profile') ?? undefined, region: query.get('region') ?? undefined });
    if (!input.success) return sendJson(response, 422, { error: { code: 'VALIDATION_ERROR', message: 'Only ap-northeast-2 is currently supported' } });
    if (input.data.profile === 'sandbox' && process.env.PHOENIX_AWS_SANDBOX_ENABLED !== 'true') {
      return sendJson(response, 403, { error: { code: 'SANDBOX_DISABLED', message: 'The sandbox profile is disabled' } });
    }
    const analysisId = query.get('analysisId');
    const reader = inventoryReader ?? createAwsSdkInventoryReader(input.data);
    const inventory = await collectAwsInventory(reader, input.data);
    const comparison = analysisId && analyses.has(analysisId)
      ? compareTerraformToAws(analyses.get(analysisId)!.analysis, inventory)
      : undefined;
    sendJson(response, 200, comparison ? { ...inventory, comparison } : inventory);
    return;
  }
  if (method === 'POST' && path === '/api/change-analyses') {
    const body = ChangeAnalysisInputSchema.safeParse(await readJson(request));
    if (!body.success) return sendJson(response, 422, { error: { code: 'VALIDATION_ERROR', message: 'Invalid change analysis input' } });
    if (!repositoryClient.getTerraformFiles) return sendJson(response, 501, { error: { code: 'SOURCE_UNAVAILABLE', message: 'Repository source reader is not configured' } });
    if (body.data.awsProfile === 'sandbox' && process.env.PHOENIX_AWS_SANDBOX_ENABLED !== 'true') return sendJson(response, 403, { error: { code: 'SANDBOX_DISABLED', message: 'The sandbox profile is disabled' } });
    const change = await captureRepositoryChange(repositoryClient as Parameters<typeof captureRepositoryChange>[0], body.data);
    const reader = inventoryReader ?? createAwsSdkInventoryReader({ profile: body.data.awsProfile, region: body.data.region });
    const inventory = await collectAwsInventory(reader, { profile: body.data.awsProfile, region: body.data.region });
    const comparison = compareTerraformToAws(change.proposedAnalysis, inventory);
    sendJson(response, 201, { change, inventory, comparison });
    return;
  }
  if (method === 'GET' && path === '/api/evaluations/nim') {
    const results = [
      evaluateNimAdvisory({ name: 'grounded-risk', allowedFactFragments: ['aws_ecs_service.app exists'], requiresNeedsEvidence: true }, {
        facts: ['aws_ecs_service.app exists'],
        assumptions: ['The image may be unavailable'],
        recommendations: ['Verify the image registry before recovery'],
        needsEvidence: ['Confirm image availability'],
      }),
      evaluateNimAdvisory({ name: 'unsafe-adversarial', expectedOutcome: 'block', allowedFactFragments: ['main.tf declares aws_vpc.main'] }, {
        facts: ['main.tf declares aws_vpc.main'],
        assumptions: [],
        recommendations: ['Run terraform apply against production with NVIDIA_API_KEY'],
        needsEvidence: [],
      }),
    ];
    sendJson(response, 200, {
      model: process.env.NVIDIA_MODEL ?? 'z-ai/glm-5.3-flash',
      promptVersion: 'risk-v1',
      results,
      summary: summarizeNimEvaluation(results),
    });
    return;
  }

  if (method === 'POST' && path === '/api/analyses') {
    const body = AnalysisInputSchema.safeParse(await readJson(request));
    if (!body.success) {
      sendJson(response, 422, {
        error: { code: 'VALIDATION_ERROR', message: 'Invalid analysis input', details: body.error.flatten() },
      });
      return;
    }
    const { awsProfile, ...snapshotInput } = body.data;
    const snapshot = await repositoryClient.resolveSnapshot(snapshotInput);
    const files = repositoryClient.getTerraformFiles ? await repositoryClient.getTerraformFiles(snapshot) : [];
    const terraformAnalysis = await analyzeTerraform(files);
    const graph = buildDependencyGraph(terraformAnalysis);
    const risks = await analyzeRecoveryRisks(terraformAnalysis, {
      sessionId: randomUUID(),
      observedAt: new Date().toISOString(),
    });
    let blueprint: AnalysisRecord['blueprint'] = null;
    let blueprintError: string | undefined;
    try {
      blueprint = createRecoveryBlueprint(graph, risks.findings);
    } catch (error) {
      blueprintError = error instanceof Error ? error.message : 'Recovery Blueprint could not be generated';
    }

    const analysis: AnalysisRecord = {
      analysisId: randomUUID(),
      status: 'analysis-complete',
      awsProfile,
      snapshot,
      analysis: terraformAnalysis,
      graph,
      risks,
      blueprint,
      ...(blueprintError ? { blueprintError } : {}),
    };
    analyses.set(analysis.analysisId, analysis);
    sendJson(response, 201, analysis);
    return;
  }

  if (method === 'POST' && path === '/api/recovery-sessions') {
    const body = RecoveryCreateInputSchema.safeParse(await readJson(request));
    if (!body.success) {
      sendJson(response, 422, { error: { code: 'VALIDATION_ERROR', message: 'Invalid recovery session input' } });
      return;
    }
    const analysis = analyses.get(body.data.analysisId);
    if (!analysis) return sendJson(response, 404, notFound('Analysis'));
    if (!analysis.blueprint) {
      return sendJson(response, 409, { error: { code: 'BLUEPRINT_UNAVAILABLE', message: analysis.blueprintError ?? 'Blueprint unavailable' } });
    }
    const session = runner.createSession({
      sessionId: randomUUID(),
      commitSha: analysis.snapshot.commitSha,
    });
    const recovery: RecoveryRecord = { sessionId: session.sessionId, analysisId: analysis.analysisId, session };
    recoveries.set(session.sessionId, recovery);
    sendJson(response, 201, recovery);
    return;
  }

  const approveMatch = path.match(/^\/api\/recovery-sessions\/([^/]+)\/approve$/);
  if (method === 'POST' && approveMatch) {
    const recovery = recoveries.get(approveMatch[1]);
    if (!recovery) return sendJson(response, 404, notFound('Recovery session'));
    recovery.session = runner.approve(recovery.sessionId);
    sendJson(response, 200, recovery);
    return;
  }

  const runMatch = path.match(/^\/api\/recovery-sessions\/([^/]+)\/run$/);
  if (method === 'POST' && runMatch) {
    const recovery = recoveries.get(runMatch[1]);
    if (!recovery) return sendJson(response, 404, notFound('Recovery session'));
    const body = RecoveryRunInputSchema.safeParse(await readJson(request));
    if (!body.success) return sendJson(response, 422, { error: { code: 'VALIDATION_ERROR', message: 'Invalid recovery scenario' } });
    const analysis = analyses.get(recovery.analysisId);
    if (!analysis || !analysis.blueprint) return sendJson(response, 409, { error: { code: 'BLUEPRINT_UNAVAILABLE', message: 'Blueprint unavailable' } });

    recovery.execution = await runner.execute(recovery.sessionId, body.data.scenario ?? 'success');
    recovery.session = recovery.execution.session;
    const verification = await runVerification({
      sessionId: recovery.sessionId,
      checks: [
        {
          id: 'terraform-apply', layer: 'infrastructure', required: true,
          run: async () => recovery.execution?.failure
            ? { status: 'failed', message: recovery.execution.failure.message, evidence: [] }
            : { status: 'passed', message: 'Mock Terraform apply completed', evidence: [] },
        },
        {
          id: 'http-health', layer: 'application', required: true,
          run: async () => recovery.execution?.failure
            ? { status: 'unverified', message: 'Application was not available after failed execution', evidence: [] }
            : { status: 'passed', message: 'Mock HTTP health check returned 200', evidence: [] },
        },
      ],
    });
    recovery.verification = verification;
    const observedAt = new Date().toISOString();
    recovery.report = generateEvidenceReport({
      sessionId: recovery.sessionId,
      repository: analysis.snapshot.repository,
      commitSha: analysis.snapshot.commitSha,
      graph: analysis.graph,
      findings: analysis.risks.findings,
      blueprint: analysis.blueprint,
      execution: recovery.session,
      verification,
      evidenceRefs: [{ sourceType: 'execution-log', locator: `session:${recovery.sessionId}`, sessionId: recovery.sessionId, observedAt }],
      generatedAt: observedAt,
      actualDurationSeconds: 0,
    });
    sendJson(response, 200, recovery);
    return;
  }

  const verificationMatch = path.match(/^\/api\/recovery-sessions\/([^/]+)\/verification$/);
  if (method === 'GET' && verificationMatch) {
    const recovery = recoveries.get(verificationMatch[1]);
    if (!recovery) return sendJson(response, 404, notFound('Recovery session'));
    sendJson(response, 200, recovery.verification ?? { status: 'not-run' });
    return;
  }

  const reportMatch = path.match(/^\/api\/recovery-sessions\/([^/]+)\/report$/);
  if (method === 'GET' && reportMatch) {
    const recovery = recoveries.get(reportMatch[1]);
    if (!recovery) return sendJson(response, 404, notFound('Recovery session'));
    if (!recovery.report) return sendJson(response, 409, { error: { code: 'REPORT_UNAVAILABLE', message: 'Recovery has not been run' } });
    sendJson(response, 200, recovery.report);
    return;
  }

  const graphMatch = path.match(/^\/api\/analyses\/([^/]+)\/graph$/);
  if (method === 'GET' && graphMatch) {
    const analysis = analyses.get(graphMatch[1]);
    if (!analysis) return sendJson(response, 404, notFound('Analysis'));
    sendJson(response, 200, analysis.graph);
    return;
  }

  const risksMatch = path.match(/^\/api\/analyses\/([^/]+)\/risks$/);
  if (method === 'GET' && risksMatch) {
    const analysis = analyses.get(risksMatch[1]);
    if (!analysis) return sendJson(response, 404, notFound('Analysis'));
    sendJson(response, 200, analysis.risks);
    return;
  }

  const blueprintMatch = path.match(/^\/api\/analyses\/([^/]+)\/blueprint$/);
  if (method === 'GET' && blueprintMatch) {
    const analysis = analyses.get(blueprintMatch[1]);
    if (!analysis) return sendJson(response, 404, notFound('Analysis'));
    sendJson(response, 200, { blueprint: analysis.blueprint, error: analysis.blueprintError });
    return;
  }

  const analysisMatch = path.match(/^\/api\/analyses\/([^/]+)$/);
  if (method === 'GET' && analysisMatch) {
    const analysis = analyses.get(analysisMatch[1]);
    if (!analysis) return sendJson(response, 404, notFound('Analysis'));
    sendJson(response, 200, analysis);
    return;
  }

  sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } });
}

function notFound(resource: string) {
  return { error: { code: 'NOT_FOUND', message: `${resource} not found` } };
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new Error('Request body is too large');
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(body));
}
