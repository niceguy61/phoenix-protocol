import { createHash } from 'node:crypto';
import type { RepositorySnapshot, RepositorySourceFile, ResolveSnapshotInput } from './index';

export interface ChangeCaptureInput {
  repositoryUrl: string;
  baseRef: string;
  proposedRef: string;
  terraformRoot: string;
}

export interface ChangeSnapshotReader {
  resolveSnapshot(input: ResolveSnapshotInput): Promise<RepositorySnapshot>;
  getTerraformFiles(snapshot: RepositorySnapshot): Promise<RepositorySourceFile[]>;
}

export interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  baseHash?: string;
  proposedHash?: string;
}

export interface RepositoryChange {
  base: RepositorySnapshot;
  proposed: RepositorySnapshot;
  changedFiles: ChangedFile[];
}

export async function captureRepositoryChange(
  reader: ChangeSnapshotReader,
  input: ChangeCaptureInput,
): Promise<RepositoryChange> {
  const [base, proposed] = await Promise.all([
    reader.resolveSnapshot({ repositoryUrl: input.repositoryUrl, ref: input.baseRef, terraformRoot: input.terraformRoot }),
    reader.resolveSnapshot({ repositoryUrl: input.repositoryUrl, ref: input.proposedRef, terraformRoot: input.terraformRoot }),
  ]);
  if (base.commitSha === proposed.commitSha) throw new Error('Base and proposed commits must differ');

  const [baseFiles, proposedFiles] = await Promise.all([
    reader.getTerraformFiles(base),
    reader.getTerraformFiles(proposed),
  ]);
  const baseHashes = new Map(baseFiles.map((file) => [file.path, hash(file.content)]));
  const proposedHashes = new Map(proposedFiles.map((file) => [file.path, hash(file.content)]));
  const paths = [...new Set([...baseHashes.keys(), ...proposedHashes.keys()])].sort();
  const changedFiles = paths.flatMap((path): ChangedFile[] => {
    const baseHash = baseHashes.get(path);
    const proposedHash = proposedHashes.get(path);
    if (!baseHash && proposedHash) return [{ path, status: 'added', proposedHash }];
    if (baseHash && !proposedHash) return [{ path, status: 'deleted', baseHash }];
    if (baseHash !== proposedHash) return [{ path, status: 'modified', baseHash, proposedHash }];
    return [];
  });

  return { base, proposed, changedFiles };
}

function hash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
