import { createHash } from 'node:crypto';
import { analyzeTerraform } from '@phoenix/analyzer';
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

export interface ChangedResource {
  address: string;
  status: 'added' | 'modified' | 'deleted';
  type: string;
}

export interface RepositoryChange {
  base: RepositorySnapshot;
  proposed: RepositorySnapshot;
  changedFiles: ChangedFile[];
  changedResources: ChangedResource[];
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

  const changedFilePaths = new Set(changedFiles.map((file) => file.path));
  const [baseAnalysis, proposedAnalysis] = await Promise.all([
    analyzeTerraform(baseFiles),
    analyzeTerraform(proposedFiles),
  ]);
  const baseResources = new Map(baseAnalysis.resources.map((resource) => [resource.address, resource]));
  const proposedResources = new Map(proposedAnalysis.resources.map((resource) => [resource.address, resource]));
  const resourceAddresses = [...new Set([...baseResources.keys(), ...proposedResources.keys()])].sort();
  const changedResources = resourceAddresses.flatMap((address): ChangedResource[] => {
    const baseResource = baseResources.get(address);
    const proposedResource = proposedResources.get(address);
    if (!baseResource && proposedResource) return [{ address, status: 'added', type: proposedResource.type }];
    if (baseResource && !proposedResource) return [{ address, status: 'deleted', type: baseResource.type }];
    if (changedFilePaths.has(baseResource?.path ?? '') || changedFilePaths.has(proposedResource?.path ?? '') || JSON.stringify(baseResource?.attributes) !== JSON.stringify(proposedResource?.attributes)) {
      return [{ address, status: 'modified', type: proposedResource?.type ?? baseResource?.type ?? 'unknown' }];
    }
    return [];
  });

  return { base, proposed, changedFiles, changedResources };
}

function hash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
