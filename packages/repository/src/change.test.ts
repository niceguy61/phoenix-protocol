import { describe, expect, it } from 'vitest';
import { captureRepositoryChange, type ChangeSnapshotReader } from './change';

const snapshots = {
  base: { repository: 'owner/repo', ref: 'main', commitSha: 'a'.repeat(40), terraformRoot: '.', snapshotId: 'base', archiveUrl: 'https://example/base' },
  proposed: { repository: 'owner/repo', ref: 'feature/change', commitSha: 'b'.repeat(40), terraformRoot: '.', snapshotId: 'proposed', archiveUrl: 'https://example/proposed' },
};

describe('captureRepositoryChange', () => {
  it('captures immutable base/proposed snapshots and changed file hashes', async () => {
    const reader: ChangeSnapshotReader = {
      resolveSnapshot: async (input) => input.ref === 'main' ? snapshots.base : snapshots.proposed,
      getTerraformFiles: async (snapshot) => snapshot.snapshotId === 'base'
        ? [{ path: 'main.tf', content: 'resource "aws_vpc" "main" {}' }, { path: 'old.tf', content: 'resource "aws_s3_bucket" "old" {}' }]
        : [{ path: 'main.tf', content: 'resource "aws_vpc" "main" { cidr_block = "10.0.0.0/16" }' }, { path: 'new.tf', content: 'resource "aws_lambda_function" "new" {}' }],
    };

    const change = await captureRepositoryChange(reader, {
      repositoryUrl: 'https://github.com/owner/repo',
      baseRef: 'main',
      proposedRef: 'feature/change',
      terraformRoot: '.',
    });

    expect(change.base.commitSha).toBe('a'.repeat(40));
    expect(change.proposed.commitSha).toBe('b'.repeat(40));
    expect(change.changedFiles).toEqual([
      expect.objectContaining({ path: 'main.tf', status: 'modified' }),
      expect.objectContaining({ path: 'new.tf', status: 'added' }),
      expect.objectContaining({ path: 'old.tf', status: 'deleted' }),
    ]);
    expect(change.changedFiles.every((file) => file.baseHash || file.proposedHash)).toBe(true);
  });

  it('rejects a change where base and proposed commits are identical', async () => {
    const reader: ChangeSnapshotReader = {
      resolveSnapshot: async () => snapshots.base,
      getTerraformFiles: async () => [],
    };

    await expect(captureRepositoryChange(reader, {
      repositoryUrl: 'https://github.com/owner/repo',
      baseRef: 'main',
      proposedRef: 'main',
      terraformRoot: '.',
    })).rejects.toThrow('must differ');
  });
});
