import { DynamoDBClient, paginateListTables } from '@aws-sdk/client-dynamodb';
import { EC2Client, paginateDescribeInstances, paginateDescribeVpcs } from '@aws-sdk/client-ec2';
import { ECSClient, paginateListClusters } from '@aws-sdk/client-ecs';
import { ElasticLoadBalancingV2Client, paginateDescribeLoadBalancers } from '@aws-sdk/client-elastic-load-balancing-v2';
import { LambdaClient, paginateListFunctions } from '@aws-sdk/client-lambda';
import { RDSClient, paginateDescribeDBInstances } from '@aws-sdk/client-rds';
import { ListBucketsCommand, S3Client } from '@aws-sdk/client-s3';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { paginateGetResources, ResourceGroupsTaggingAPIClient } from '@aws-sdk/client-resource-groups-tagging-api';
import { fromIni } from '@aws-sdk/credential-providers';
import type { AwsInventoryReader, AwsResourceSummary } from './aws-inventory';

export function createAwsSdkInventoryReader(input: { profile: 'default' | 'sandbox'; region: 'ap-northeast-2' }): AwsInventoryReader {
  const config = { region: input.region, credentials: fromIni({ profile: input.profile }), maxAttempts: 3 };
  const ec2 = new EC2Client(config);
  const ecs = new ECSClient(config);
  const elb = new ElasticLoadBalancingV2Client(config);
  const rds = new RDSClient(config);
  const s3 = new S3Client(config);
  const dynamodb = new DynamoDBClient(config);
  const lambda = new LambdaClient(config);
  const sts = new STSClient(config);
  const tagging = new ResourceGroupsTaggingAPIClient(config);

  return {
    async getCallerIdentity() {
      const output = await sts.send(new GetCallerIdentityCommand({}));
      return { accountId: output.Account ?? 'unknown', arn: output.Arn ?? 'unknown' };
    },
    async listVpcs() {
      const resources: AwsResourceSummary[] = [];
      for await (const page of paginateDescribeVpcs({ client: ec2 }, {})) {
        for (const vpc of page.Vpcs ?? []) if (vpc.VpcId) resources.push({ id: vpc.VpcId, kind: 'vpc', status: vpc.State ?? 'unknown', metadata: { cidr: vpc.CidrBlock ?? '' } });
      }
      return resources;
    },
    async listEc2Instances() {
      const resources: AwsResourceSummary[] = [];
      for await (const page of paginateDescribeInstances({ client: ec2 }, { Filters: [{ Name: 'instance-state-name', Values: ['pending', 'running', 'stopping', 'stopped'] }] })) {
        for (const reservation of page.Reservations ?? []) for (const instance of reservation.Instances ?? []) if (instance.InstanceId) resources.push({ id: instance.InstanceId, kind: 'ec2-instance', status: instance.State?.Name ?? 'unknown', metadata: { type: instance.InstanceType ?? '' } });
      }
      return resources;
    },
    async listEcsClusters() {
      const resources: AwsResourceSummary[] = [];
      for await (const page of paginateListClusters({ client: ecs }, {})) for (const arn of page.clusterArns ?? []) resources.push({ id: arn, kind: 'ecs-cluster', status: 'active' });
      return resources;
    },
    async listLoadBalancers() {
      const resources: AwsResourceSummary[] = [];
      for await (const page of paginateDescribeLoadBalancers({ client: elb }, {})) for (const loadBalancer of page.LoadBalancers ?? []) if (loadBalancer.LoadBalancerArn) resources.push({ id: loadBalancer.LoadBalancerArn, kind: 'load-balancer', status: loadBalancer.State?.Code ?? 'unknown', name: loadBalancer.LoadBalancerName, metadata: { type: loadBalancer.Type ?? '' } });
      return resources;
    },
    async listRdsInstances() {
      const resources: AwsResourceSummary[] = [];
      for await (const page of paginateDescribeDBInstances({ client: rds }, {})) for (const instance of page.DBInstances ?? []) if (instance.DBInstanceIdentifier) resources.push({ id: instance.DBInstanceIdentifier, kind: 'rds-instance', status: instance.DBInstanceStatus ?? 'unknown', metadata: { engine: instance.Engine ?? '' } });
      return resources;
    },
    async listS3Buckets() {
      const output = await s3.send(new ListBucketsCommand({}));
      return (output.Buckets ?? []).filter((bucket) => bucket.Name).map((bucket) => ({ id: bucket.Name as string, kind: 's3-bucket', status: 'available' }));
    },
    async listDynamoDbTables() {
      const resources: AwsResourceSummary[] = [];
      for await (const page of paginateListTables({ client: dynamodb }, {})) for (const name of page.TableNames ?? []) resources.push({ id: name, kind: 'dynamodb-table', status: 'available' });
      return resources;
    },
    async listLambdaFunctions() {
      const resources: AwsResourceSummary[] = [];
      for await (const page of paginateListFunctions({ client: lambda }, {})) for (const fn of page.Functions ?? []) if (fn.FunctionArn) resources.push({ id: fn.FunctionArn, kind: 'lambda-function', status: 'active', name: fn.FunctionName, metadata: { runtime: fn.Runtime ?? '' } });
      return resources;
    },
    async listTaggedResources() {
      const resources: AwsResourceSummary[] = [];
      for await (const page of paginateGetResources({ client: tagging }, {})) for (const mapping of page.ResourceTagMappingList ?? []) if (mapping.ResourceARN) resources.push({ id: mapping.ResourceARN, kind: 'tagged-resource', status: 'tagged', metadata: Object.fromEntries((mapping.Tags ?? []).filter((tag) => tag.Key).map((tag) => [tag.Key as string, tag.Value ?? ''])) });
      return resources;
    },
  };
}
