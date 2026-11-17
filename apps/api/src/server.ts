import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { GitHubRepositoryClient, type RepositorySnapshot, type RepositorySourceFile } from '@phoenix/repository';
import { analyzeTerraform, buildDependencyGraph, type TerraformAnalysis } from '@phoenix/analyzer';
import { analyzeRecoveryRisks, createRecoveryBlueprint, type RiskAnalysisResult } from '@phoenix/recovery';

const AnalysisInputSchema = z.object({
  repositoryUrl: z.string().url(),
  ref: z.string().min(1).max(256),
  terraformRoot: z.string().min(1).max(512),
});

type AnalysisRecord = {
  analysisId: string;
  status: 'analysis-complete';
  snapshot: RepositorySnapshot;
  analysis: TerraformAnalysis;
  graph: ReturnType<typeof buildDependencyGraph>;
  risks: RiskAnalysisResult;
  blueprint: ReturnType<typeof createRecoveryBlueprint> | null;
  blueprintError?: string;
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
}

export function createApiServer(options: ApiServerOptions = {}): Server {
  const repositoryClient = options.repositoryClient ?? new GitHubRepositoryClient();
  const analyses = new Map<string, AnalysisRecord>();

  return createServer(async (request, response) => {
    try {
      await route(request, response, repositoryClient, analyses);
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
  analyses: Map<string, AnalysisRecord>,
): Promise<void> {
  const method = request.method ?? 'GET';
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  const origin = request.headers.origin;
  if (origin === 'http://localhost:3000' || origin === 'http://127.0.0.1:3000') {
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

  if (method === 'POST' && path === '/api/analyses') {
    const body = AnalysisInputSchema.safeParse(await readJson(request));
    if (!body.success) {
      sendJson(response, 422, {
        error: { code: 'VALIDATION_ERROR', message: 'Invalid analysis input', details: body.error.flatten() },
      });
      return;
    }
    const snapshot = await repositoryClient.resolveSnapshot(body.data);
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
    if (!analysis) {
      sendJson(response, 404, notFound('Analysis'));
      return;
    }
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
