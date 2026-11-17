export interface AwsResourceSummary {
  id: string;
  kind: string;
  status: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface AwsInventoryReader {
  getCallerIdentity(): Promise<{ accountId: string; arn: string }>;
  listVpcs(): Promise<AwsResourceSummary[]>;
  listEc2Instances(): Promise<AwsResourceSummary[]>;
  listEcsClusters(): Promise<AwsResourceSummary[]>;
  listLoadBalancers(): Promise<AwsResourceSummary[]>;
  listRdsInstances(): Promise<AwsResourceSummary[]>;
  listS3Buckets(): Promise<AwsResourceSummary[]>;
  listDynamoDbTables(): Promise<AwsResourceSummary[]>;
  listLambdaFunctions(): Promise<AwsResourceSummary[]>;
  listTaggedResources?(): Promise<AwsResourceSummary[]>;
}

export interface AwsInventoryInput {
  profile: 'default' | 'sandbox';
  region: 'ap-northeast-2';
}

export interface AwsInventorySnapshot {
  profile: AwsInventoryInput['profile'];
  region: AwsInventoryInput['region'];
  accountId: string;
  collectedAt: string;
  coverage: { taggedResourceCount: number; limitations: string[] };
  resources: AwsResourceSummary[];
}

export async function collectAwsInventory(
  reader: AwsInventoryReader,
  input: AwsInventoryInput,
): Promise<AwsInventorySnapshot> {
  const identity = await reader.getCallerIdentity();
  const resources = (await Promise.all([
    reader.listVpcs(),
    reader.listEc2Instances(),
    reader.listEcsClusters(),
    reader.listLoadBalancers(),
    reader.listRdsInstances(),
    reader.listS3Buckets(),
    reader.listDynamoDbTables(),
    reader.listLambdaFunctions(),
    reader.listTaggedResources?.() ?? Promise.resolve([]),
  ])).flat();
  const taggedResourceCount = resources.filter((resource) => resource.kind === 'tagged-resource').length;

  return {
    profile: input.profile,
    region: input.region,
    accountId: identity.accountId,
    collectedAt: new Date().toISOString(),
    coverage: {
      taggedResourceCount,
      limitations: ['Service-specific queries cover the initial MVP set; tagged resources extend coverage. Untagged resources may require service-specific readers.'],
    },
    resources,
  };
}
