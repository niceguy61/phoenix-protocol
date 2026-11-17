import { afterEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createApiServer, type RepositoryClient } from './server';

const snapshot = {
  repository: 'niceguy61/phoenix-protocol',
  ref: 'feature/initial-scaffold',
  commitSha: '0123456789abcdef0123456789abcdef01234567',
  terraformRoot: '.',
  snapshotId: 'snapshot-1',
  archiveUrl: 'https://codeload.github.com/niceguy61/phoenix-protocol/tar.gz/0123456789abcdef0123456789abcdef01234567',
};

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function request(server: Server, path: string, init?: RequestInit) {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server is not listening');
  return fetch(`http://127.0.0.1:${address.port}${path}`, init);
}

describe('createApiServer', () => {
  it('returns a health response', async () => {
    const repositoryClient: RepositoryClient = { resolveSnapshot: async () => snapshot };
    const server = createApiServer({ repositoryClient }).listen(0);
    servers.push(server);

    const response = await request(server, '/api/health', { headers: { origin: 'http://127.0.0.1:3010' } });
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:3010');
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('returns the NIM golden/adversarial evaluation summary without credentials', async () => {
    const repositoryClient: RepositoryClient = { resolveSnapshot: async () => snapshot };
    const server = createApiServer({ repositoryClient }).listen(0);
    servers.push(server);

    const response = await request(server, '/api/evaluations/nim');
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.model).toBe('z-ai/glm-5.3-flash');
    expect(payload.summary.total).toBe(2);
    expect(payload.summary.passed).toBe(false);
    expect(JSON.stringify(payload)).not.toContain('NVIDIA_API_KEY');
  });
  it('resolves a repository snapshot through the API contract', async () => {
    const repositoryClient: RepositoryClient = {
      resolveSnapshot: async () => snapshot,
      getTerraformFiles: async () => [{ path: 'main.tf', content: 'resource "aws_vpc" "main" { cidr_block = "10.0.0.0/16" }' }],
    };
    const server = createApiServer({ repositoryClient }).listen(0);
    servers.push(server);

    const response = await request(server, '/api/analyses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repositoryUrl: 'https://github.com/niceguy61/phoenix-protocol', ref: 'feature/initial-scaffold', terraformRoot: '.' }),
    });

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload).toEqual(expect.objectContaining({ status: 'analysis-complete', snapshot }));
    expect(payload.graph.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'aws_vpc.main' })]));
    expect(payload.blueprint.steps).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'terraform-apply', approvalRequired: true })]));
  });

  it('runs the approved mock recovery flow and returns verification/report evidence', async () => {
    const repositoryClient: RepositoryClient = {
      resolveSnapshot: async () => snapshot,
      getTerraformFiles: async () => [{ path: 'main.tf', content: 'resource "aws_vpc" "main" { cidr_block = "10.0.0.0/16" }' }],
    };
    const server = createApiServer({ repositoryClient }).listen(0);
    servers.push(server);

    const analysisResponse = await request(server, '/api/analyses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repositoryUrl: 'https://github.com/niceguy61/phoenix-protocol', ref: 'feature/initial-scaffold', terraformRoot: '.' }),
    });
    const analysis = await analysisResponse.json();
    const sessionResponse = await request(server, '/api/recovery-sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ analysisId: analysis.analysisId }),
    });
    const session = await sessionResponse.json();
    expect(session.session.status).toBe('awaiting-approval');

    await request(server, `/api/recovery-sessions/${session.sessionId}/approve`, { method: 'POST' });
    const runResponse = await request(server, `/api/recovery-sessions/${session.sessionId}/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scenario: 'success' }),
    });
    const run = await runResponse.json();

    expect(run.verification.recoveryVerified).toBe(true);
    expect(run.report.report.status).toBe('recovery-verified');
  });
  it('returns structured validation errors for invalid analysis input', async () => {
    const repositoryClient: RepositoryClient = { resolveSnapshot: async () => snapshot };
    const server = createApiServer({ repositoryClient }).listen(0);
    servers.push(server);

    const response = await request(server, '/api/analyses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repositoryUrl: 'not-a-url', ref: '', terraformRoot: '../outside' }),
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual(expect.objectContaining({
      error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    }));
  });
});
