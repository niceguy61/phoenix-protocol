import { describe, expect, it } from 'vitest';
import { collectAwsInventory, type AwsInventoryReader } from './aws-inventory';

const reader: AwsInventoryReader = {
  getCallerIdentity: async () => ({ accountId: '261250906071', arn: 'arn:aws:sts::261250906071:assumed-role/test/user' }),
  listVpcs: async () => [{ id: 'vpc-1', kind: 'vpc', status: 'available' }],
  listEc2Instances: async () => [{ id: 'i-1', kind: 'ec2-instance', status: 'running' }],
  listEcsClusters: async () => [{ id: 'cluster-1', kind: 'ecs-cluster', status: 'active' }],
  listLoadBalancers: async () => [{ id: 'alb-1', kind: 'load-balancer', status: 'active' }],
  listRdsInstances: async () => [],
  listS3Buckets: async () => [{ id: 'bucket-1', kind: 's3-bucket', status: 'available' }],
  listDynamoDbTables: async () => [{ id: 'table-1', kind: 'dynamodb-table', status: 'active' }],
  listLambdaFunctions: async () => [{ id: 'lambda-1', kind: 'lambda-function', status: 'active' }],
};

describe('collectAwsInventory', () => {
  it('collects a read-only resource snapshot for the selected profile and region', async () => {
    const inventory = await collectAwsInventory(reader, { profile: 'default', region: 'ap-northeast-2' });

    expect(inventory.accountId).toBe('261250906071');
    expect(inventory.profile).toBe('default');
    expect(inventory.region).toBe('ap-northeast-2');
    expect(inventory.resources).toHaveLength(7);
    expect(inventory.resources.find((resource) => resource.kind === 'dynamodb-table')).toEqual(expect.objectContaining({ id: 'table-1' }));
    expect(JSON.stringify(inventory)).not.toContain('secret');
  });

  it('preserves a service failure as an explicit inventory error', async () => {
    await expect(collectAwsInventory({ ...reader, listRdsInstances: async () => { throw new Error('AccessDenied'); } }, { profile: 'default', region: 'ap-northeast-2' })).rejects.toThrow('AccessDenied');
  });
});
