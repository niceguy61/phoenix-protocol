import { describe, expect, it } from 'vitest';
import type { TerraformAnalysis } from '@phoenix/analyzer';
import type { AwsInventorySnapshot } from './aws-inventory';
import { compareTerraformToAws } from './inventory-diff';

const analysis: TerraformAnalysis = {
  filesAnalyzed: ['main.tf'],
  resources: [
    { path: 'main.tf', line: 1, address: 'aws_vpc.main', type: 'aws_vpc', name: 'main', attributes: {} },
    { path: 'main.tf', line: 2, address: 'aws_s3_bucket.assets', type: 'aws_s3_bucket', name: 'assets', attributes: {} },
  ],
  modules: [], dataSources: [], variables: [], outputs: [], dependencies: [], unsupported: [], hardcodedValues: [], externalPrerequisites: [], diagnostics: [],
};
const inventory: AwsInventorySnapshot = {
  profile: 'default', region: 'ap-northeast-2', accountId: '261250906071', collectedAt: '2026-11-17T00:00:00.000Z',
  coverage: { taggedResourceCount: 1, limitations: [] },
  resources: [
    { id: 'vpc-1', kind: 'vpc', status: 'available' },
    { id: 'bucket-1', kind: 's3-bucket', status: 'available' },
    { id: 'bucket-2', kind: 's3-bucket', status: 'available' },
    { id: 'tagged', kind: 'tagged-resource', status: 'tagged' },
  ],
};

describe('compareTerraformToAws', () => {
  it('reports count-based managed and unmanaged differences without claiming exact drift', () => {
    const result = compareTerraformToAws(analysis, inventory);

    expect(result.mode).toBe('count-heuristic');
    expect(result.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'vpc', declared: 1, actual: 1, status: 'matched' }),
      expect.objectContaining({ kind: 's3-bucket', declared: 1, actual: 2, status: 'unmanaged-candidate' }),
    ]));
    expect(result.limitations).toContain('Counts do not prove exact resource identity or drift.');
  });
});
