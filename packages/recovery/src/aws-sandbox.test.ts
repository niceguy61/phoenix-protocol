import { describe, expect, it } from 'vitest';
import { buildDynamoDbSmokePlan, validateDynamoDbSmokePreflight } from './aws-sandbox';

describe('DynamoDB smoke sandbox plan', () => {
  it('builds a uniquely scoped, pay-per-request smoke plan', () => {
    const plan = buildDynamoDbSmokePlan({
      tableName: 'phoenix-smoke-20261117-153500',
      region: 'ap-northeast-2',
      keyName: 'id',
    });

    expect(plan.create.mode).toBe('PAY_PER_REQUEST');
    expect(plan.create.tableName).toBe('phoenix-smoke-20261117-153500');
    expect(plan.create.tags).toEqual(expect.objectContaining({ Project: 'phoenix-protocol', Purpose: 'smoke-test' }));
    expect(plan.cleanup.mustDeleteOnlyThisTable).toBe(true);
  });

  it('rejects a preflight collision or non-scoped table name', () => {
    expect(() => validateDynamoDbSmokePreflight({
      accountId: '261250906071',
      expectedAccountId: '261250906071',
      region: 'ap-northeast-2',
      tableName: 'production-table',
      existingTableNames: [],
    })).toThrow('phoenix-smoke-');

    expect(() => validateDynamoDbSmokePreflight({
      accountId: '261250906071',
      expectedAccountId: '261250906071',
      region: 'ap-northeast-2',
      tableName: 'phoenix-smoke-20261117-153500',
      existingTableNames: ['phoenix-smoke-20261117-153500'],
    })).toThrow('already exists');
  });

  it('rejects a preflight account mismatch', () => {
    expect(() => validateDynamoDbSmokePreflight({
      accountId: 'other-account',
      expectedAccountId: '261250906071',
      region: 'ap-northeast-2',
      tableName: 'phoenix-smoke-20261117-153500',
      existingTableNames: [],
    })).toThrow('account mismatch');
  });
});
