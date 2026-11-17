import { describe, expect, it } from 'vitest';
import { GitHubRepositoryClient } from '../../packages/repository/src/index';

const liveEnabled = process.env.REPOSITORY_LIVE_TEST === '1';

describe.skipIf(!liveEnabled)('public GitHub repository integration', () => {
  it('resolves the Phoenix Protocol public branch to a commit-pinned snapshot', async () => {
    const client = new GitHubRepositoryClient();
    const snapshot = await client.resolveSnapshot({
      repositoryUrl: 'https://github.com/niceguy61/phoenix-protocol',
      ref: 'feature/initial-scaffold',
      terraformRoot: '.',
    });

    expect(snapshot.repository).toBe('niceguy61/phoenix-protocol');
    expect(snapshot.commitSha).toMatch(/^[a-f0-9]{40}$/);
    expect(snapshot.archiveUrl).toContain(`/tar.gz/${snapshot.commitSha}`);
  }, 30_000);
});
