export interface DynamoDbSmokeConfig {
  tableName: string;
  region: 'ap-northeast-2';
  keyName: string;
}

export interface DynamoDbSmokePlan {
  create: {
    tableName: string;
    region: string;
    mode: 'PAY_PER_REQUEST';
    keyName: string;
    tags: Record<string, string>;
  };
  verify: {
    expectedKeyName: string;
    expectedBillingMode: 'PAY_PER_REQUEST';
  };
  cleanup: {
    mustDeleteOnlyThisTable: true;
    tableName: string;
  };
}

export interface DynamoDbSmokePreflight {
  accountId: string;
  expectedAccountId: string;
  region: string;
  tableName: string;
  existingTableNames: string[];
}

export function buildDynamoDbSmokePlan(config: DynamoDbSmokeConfig): DynamoDbSmokePlan {
  if (!config.tableName.startsWith('phoenix-smoke-')) throw new Error('DynamoDB smoke table must use the phoenix-smoke- prefix');
  if (!/^phoenix-smoke-[a-z0-9-]{1,240}$/.test(config.tableName)) throw new Error('DynamoDB smoke table name is invalid');
  if (config.region !== 'ap-northeast-2') throw new Error('DynamoDB smoke test is pinned to ap-northeast-2');
  if (!config.keyName || !/^[A-Za-z0-9_]{1,64}$/.test(config.keyName)) throw new Error('DynamoDB key name is invalid');

  return {
    create: {
      tableName: config.tableName,
      region: config.region,
      mode: 'PAY_PER_REQUEST',
      keyName: config.keyName,
      tags: { Project: 'phoenix-protocol', Purpose: 'smoke-test', ManagedBy: 'phoenix-protocol' },
    },
    verify: { expectedKeyName: config.keyName, expectedBillingMode: 'PAY_PER_REQUEST' },
    cleanup: { mustDeleteOnlyThisTable: true, tableName: config.tableName },
  };
}

export function validateDynamoDbSmokePreflight(input: DynamoDbSmokePreflight): void {
  if (input.accountId !== input.expectedAccountId) throw new Error('DynamoDB smoke account mismatch');
  if (input.region !== 'ap-northeast-2') throw new Error('DynamoDB smoke region mismatch');
  if (!input.tableName.startsWith('phoenix-smoke-')) throw new Error('DynamoDB smoke table must use the phoenix-smoke- prefix');
  if (input.existingTableNames.includes(input.tableName)) throw new Error('DynamoDB smoke table already exists');
}
