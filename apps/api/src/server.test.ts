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

    const response = await request(server, '/api/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('resolves a repository snapshot through the API contract', async () => {
    const repositoryClient: RepositoryClient = { resolveSnapshot: async () => snapshot };
    const server = createApiServer({ repositoryClient }).listen(0);
    servers.push(server);

    const response = await request(server, '/api/analyses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repositoryUrl: 'https://github.com/niceguy61/phoenix-protocol', ref: 'feature/initial-scaffold', terraformRoot: '.' }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(expect.objectContaining({ status: 'snapshot-resolved', snapshot }));
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
