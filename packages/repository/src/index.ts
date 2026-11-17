import { SourceSnapshotSchema } from '@phoenix/contracts';
import { z } from 'zod';

const GitHubCommitResponseSchema = z.object({
  sha: z.string().regex(/^[a-f0-9]{40}$/),
});

const GitHubRepositoryUrlSchema = z.object({
  owner: z.string().regex(/^[A-Za-z0-9_.-]+$/),
  name: z.string().regex(/^[A-Za-z0-9_.-]+$/),
});

export interface GitHubRepositoryRef {
  owner: string;
  name: string;
}

export interface ResolveSnapshotInput {
  repositoryUrl: string;
  ref: string;
  terraformRoot: string;
}

export interface RepositorySnapshot {
  repository: string;
  ref: string;
  commitSha: string;
  terraformRoot: string;
  snapshotId: string;
  archiveUrl: string;
}

export interface GitHubRepositoryClientOptions {
  apiBaseUrl?: string;
  token?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class InvalidRepositoryUrlError extends Error {
  constructor() {
    super('Repository URL must point to a public GitHub repository');
    this.name = 'InvalidRepositoryUrlError';
  }
}

export class InvalidTerraformRootError extends Error {
  constructor() {
    super('Terraform root must remain inside the repository');
    this.name = 'InvalidTerraformRootError';
  }
}

export class GitHubRepositoryError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'GitHubRepositoryError';
  }
}

export function parseGitHubRepositoryUrl(repositoryUrl: string): GitHubRepositoryRef {
  let parsed: URL;
  try {
    parsed = new URL(repositoryUrl);
  } catch {
    throw new InvalidRepositoryUrlError();
  }

  if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 'github.com') {
    throw new InvalidRepositoryUrlError();
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length !== 2 && !(segments.length === 2 && segments[1].endsWith('.git'))) {
    throw new InvalidRepositoryUrlError();
  }
  if (parsed.search || parsed.hash) throw new InvalidRepositoryUrlError();

  const result = GitHubRepositoryUrlSchema.safeParse({
    owner: segments[0],
    name: segments[1].replace(/\.git$/, ''),
  });
  if (!result.success) throw new InvalidRepositoryUrlError();
  return result.data;
}

export function normalizeTerraformRoot(terraformRoot: string): string {
  const normalized = terraformRoot.trim().replaceAll('\\', '/').replace(/^\.\//, '');
  if (!normalized || normalized === '.') return '.';
  if (normalized.startsWith('/') || normalized.split('/').some((segment) => segment === '..')) {
    throw new InvalidTerraformRootError();
  }
  if (normalized.split('/').some((segment) => segment.length === 0 || segment === '.')) {
    throw new InvalidTerraformRootError();
  }
  return normalized;
}

export class GitHubRepositoryClient {
  private readonly fetchImpl: typeof fetch;
  private readonly apiBaseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly options: GitHubRepositoryClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.apiBaseUrl = (options.apiBaseUrl ?? 'https://api.github.com').replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async resolveSnapshot(input: ResolveSnapshotInput): Promise<RepositorySnapshot> {
    const repository = parseGitHubRepositoryUrl(input.repositoryUrl);
    const terraformRoot = normalizeTerraformRoot(input.terraformRoot);
    const ref = input.ref.trim();
    if (!ref || ref.length > 256) throw new GitHubRepositoryError('GitHub ref is invalid');

    const endpoint = `${this.apiBaseUrl}/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/commits/${encodeURIComponent(ref)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'phoenix-protocol',
      };
      if (this.options.token) headers.Authorization = `Bearer ${this.options.token}`;

      const response = await this.fetchImpl(endpoint, { headers, signal: controller.signal });
      const text = await response.text();
      if (!response.ok) {
        throw new GitHubRepositoryError(
          `GitHub commit lookup failed with status ${response.status}`,
          response.status,
        );
      }

      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new GitHubRepositoryError('GitHub returned invalid JSON for commit lookup');
      }
      const commit = GitHubCommitResponseSchema.safeParse(payload);
      if (!commit.success) throw new GitHubRepositoryError('GitHub returned an invalid commit response');

      const snapshotId = [
        'github',
        repository.owner,
        repository.name,
        commit.data.sha.slice(0, 12),
        terraformRoot === '.' ? 'root' : terraformRoot.replaceAll('/', '-'),
      ].join('-');
      const snapshot = {
        repository: `${repository.owner}/${repository.name}`,
        ref,
        commitSha: commit.data.sha,
        terraformRoot,
        snapshotId,
        archiveUrl: `https://codeload.github.com/${repository.owner}/${repository.name}/tar.gz/${commit.data.sha}`,
      };

      const valid = SourceSnapshotSchema.safeParse(snapshot);
      if (!valid.success) throw new GitHubRepositoryError('Resolved snapshot failed its contract');
      return snapshot;
    } catch (error) {
      if (error instanceof GitHubRepositoryError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new GitHubRepositoryError('GitHub commit lookup timed out');
      }
      throw new GitHubRepositoryError('GitHub commit lookup failed');
    } finally {
      clearTimeout(timeout);
    }
  }
}
