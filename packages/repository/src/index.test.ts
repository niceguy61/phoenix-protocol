import { describe, expect, it, vi } from 'vitest';
import {
  GitHubRepositoryClient,
  InvalidRepositoryUrlError,
  InvalidTerraformRootError,
  parseGitHubRepositoryUrl,
} from './index';

function response(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('parseGitHubRepositoryUrl', () => {
  it('accepts HTTPS GitHub repository URLs with an optional .git suffix', () => {
    expect(parseGitHubRepositoryUrl('https://github.com/octo-org/phoenix.git')).toEqual({
      owner: 'octo-org',
      name: 'phoenix',
    });
  });

  it('rejects non-GitHub URLs and repository URLs with extra path segments', () => {
    expect(() => parseGitHubRepositoryUrl('https://example.com/octo/phoenix')).toThrow(
      InvalidRepositoryUrlError,
    );
    expect(() => parseGitHubRepositoryUrl('https://github.com/octo/phoenix/issues')).toThrow(
      InvalidRepositoryUrlError,
    );
  });
});

describe('GitHubRepositoryClient', () => {
  it('rejects a Terraform root that escapes the repository', async () => {
    const client = new GitHubRepositoryClient({
      fetchImpl: vi.fn(),
    });

    await expect(
      client.resolveSnapshot({
        repositoryUrl: 'https://github.com/octo-org/phoenix',
        ref: 'main',
        terraformRoot: '../secrets',
      }),
    ).rejects.toBeInstanceOf(InvalidTerraformRootError);
  });

  it('resolves a ref to an immutable commit and stable archive URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({ sha: '0123456789abcdef0123456789abcdef01234567' }, {
        headers: { 'x-github-request-id': 'github-request-1' },
      }),
    );
    const client = new GitHubRepositoryClient({ fetchImpl });

    const snapshot = await client.resolveSnapshot({
      repositoryUrl: 'https://github.com/octo-org/phoenix',
      ref: 'release/v1',
      terraformRoot: 'infra/terraform',
    });

    expect(snapshot.commitSha).toBe('0123456789abcdef0123456789abcdef01234567');
    expect(snapshot.snapshotId).toBe(
      'github-octo-org-phoenix-0123456789ab-infra-terraform',
    );
    expect(snapshot.archiveUrl).toBe(
      'https://codeload.github.com/octo-org/phoenix/tar.gz/0123456789abcdef0123456789abcdef01234567',
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.github.com/repos/octo-org/phoenix/commits/release%2Fv1',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/vnd.github+json',
          'User-Agent': 'phoenix-protocol',
        }),
      }),
    );
  });

  it('rejects malformed GitHub API responses without inventing a commit', async () => {
    const client = new GitHubRepositoryClient({
      fetchImpl: vi.fn().mockResolvedValue(response({ sha: 'not-a-sha' })),
    });

    await expect(
      client.resolveSnapshot({
        repositoryUrl: 'https://github.com/octo-org/phoenix',
        ref: 'main',
        terraformRoot: '.',
      }),
    ).rejects.toThrow('invalid commit response');
  });
});
