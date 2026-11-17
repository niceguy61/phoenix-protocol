import type { TerraformAnalysis } from '@phoenix/analyzer';
import type { AwsInventorySnapshot } from './aws-inventory';

export interface InventoryDiffRow {
  kind: string;
  declared: number;
  actual: number;
  status: 'matched' | 'missing-in-aws' | 'unmanaged-candidate' | 'no-iac-evidence';
}

export interface InventoryComparison {
  mode: 'count-heuristic';
  rows: InventoryDiffRow[];
  limitations: string[];
}

const RESOURCE_KIND_MAP: Record<string, string> = {
  aws_vpc: 'vpc',
  aws_subnet: 'subnet',
  aws_instance: 'ec2-instance',
  aws_lb: 'load-balancer',
  aws_ecs_cluster: 'ecs-cluster',
  aws_db_instance: 'rds-instance',
  aws_s3_bucket: 's3-bucket',
  aws_dynamodb_table: 'dynamodb-table',
  aws_lambda_function: 'lambda-function',
};

export function compareTerraformToAws(analysis: TerraformAnalysis, inventory: AwsInventorySnapshot): InventoryComparison {
  const declared = new Map<string, number>();
  for (const resource of analysis.resources) {
    const kind = RESOURCE_KIND_MAP[resource.type];
    if (kind) declared.set(kind, (declared.get(kind) ?? 0) + 1);
  }

  const actual = new Map<string, number>();
  for (const resource of inventory.resources) {
    if (resource.kind === 'tagged-resource') continue;
    actual.set(resource.kind, (actual.get(resource.kind) ?? 0) + 1);
  }

  const kinds = [...new Set([...declared.keys(), ...actual.keys()])].sort();
  const rows = kinds.map((kind): InventoryDiffRow => {
    const declaredCount = declared.get(kind) ?? 0;
    const actualCount = actual.get(kind) ?? 0;
    const status = declaredCount === actualCount && declaredCount > 0
      ? 'matched'
      : declaredCount > 0 && actualCount === 0
        ? 'missing-in-aws'
        : declaredCount === 0 && actualCount > 0
          ? 'no-iac-evidence'
          : 'unmanaged-candidate';
    return { kind, declared: declaredCount, actual: actualCount, status };
  });

  return {
    mode: 'count-heuristic',
    rows,
    limitations: [
      'Counts do not prove exact resource identity or drift.',
      'Terraform state and provider-specific identifiers are required for exact matching.',
      'Tagged-resource coverage may include resources already represented by a service-specific reader.',
    ],
  };
}
