import { DynamoDBClient, paginateListTables } from '@aws-sdk/client-dynamodb';
import { ACMClient, ListCertificatesCommand } from '@aws-sdk/client-acm';
import { DSQLClient, ListClustersCommand } from '@aws-sdk/client-dsql';
import { APIGatewayClient, GetRestApisCommand } from '@aws-sdk/client-api-gateway';
import { ApiGatewayV2Client, GetApisCommand } from '@aws-sdk/client-apigatewayv2';
import { Route53Client, ListHostedZonesCommand } from '@aws-sdk/client-route-53';

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
  const dsql = new DSQLClient(config);
  const acm = new ACMClient(config);
  const apiGateway = new APIGatewayClient(config);
  const apiGatewayV2 = new ApiGatewayV2Client(config);
  const route53 = new Route53Client({ credentials: fromIni({ profile: input.profile }), region: 'us-east-1', maxAttempts: 3 });

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
    async listDsqlClusters() {
      const resources: AwsResourceSummary[] = [];
      let nextToken: string | undefined;
      do {
        const page = await dsql.send(new ListClustersCommand({ maxResults: 100, nextToken }));
        for (const cluster of page.clusters ?? []) if (cluster.identifier) resources.push({ id: cluster.identifier, kind: 'dsql-cluster', status: 'available', name: cluster.identifier });
        nextToken = page.nextToken;
      } while (nextToken);
      return resources;
    },
    async listRoute53HostedZones() {
      const resources: AwsResourceSummary[] = [];
      let marker: string | undefined;
      do {
        const page = await route53.send(new ListHostedZonesCommand({ Marker: marker }));
        for (const zone of page.HostedZones ?? []) if (zone.Id) resources.push({ id: zone.Id, kind: 'route53-hosted-zone', status: 'available', name: zone.Name });
        marker = page.IsTruncated ? page.NextMarker : undefined;
      } while (marker);
      return resources;
    },
    async listAcmCertificates() {
      const resources: AwsResourceSummary[] = [];
      let nextToken: string | undefined;
      do {
        const page = await acm.send(new ListCertificatesCommand({ NextToken: nextToken, MaxItems: 1000 }));
        for (const certificate of page.CertificateSummaryList ?? []) if (certificate.CertificateArn) resources.push({ id: certificate.CertificateArn, kind: 'acm-certificate', status: certificate.Status ?? 'unknown', name: certificate.DomainName });
        nextToken = page.NextToken;
      } while (nextToken);
      return resources;
    },
    async listApiGateways() {
      const resources: AwsResourceSummary[] = [];
      let position: string | undefined;
      do {
        const rest = await apiGateway.send(new GetRestApisCommand({ position, limit: 500 }));
        for (const api of rest.items ?? []) if (api.id) resources.push({ id: api.id, kind: 'api-gateway-rest', status: 'available', name: api.name });
        position = rest.position;
      } while (position);
      let nextToken: string | undefined;
      do {
        const http = await apiGatewayV2.send(new GetApisCommand({ NextToken: nextToken, MaxResults: '1000' }));
        for (const api of http.Items ?? []) if (api.ApiId) resources.push({ id: api.ApiId, kind: 'api-gateway-http', status: 'available', name: api.Name });
        nextToken = http.NextToken;
      } while (nextToken);
      return resources;
    },
    async listTaggedResources() {
      const resources: AwsResourceSummary[] = [];
      for await (const page of paginateGetResources({ client: tagging }, {})) for (const mapping of page.ResourceTagMappingList ?? []) if (mapping.ResourceARN) resources.push({ id: mapping.ResourceARN, kind: 'tagged-resource', status: 'tagged', metadata: Object.fromEntries((mapping.Tags ?? []).filter((tag) => tag.Key).map((tag) => [tag.Key as string, tag.Value ?? ''])) });
      return resources;
    },
  };
}
