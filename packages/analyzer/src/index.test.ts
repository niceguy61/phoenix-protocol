import { describe, expect, it } from 'vitest';
import { analyzeTerraform, type TerraformFile } from './index';

const validFiles: TerraformFile[] = [
  {
    path: 'main.tf',
    content: `
      variable "environment" { default = "demo" }
      variable "vpc_cidr" { default = "10.20.0.0/16" }

      resource "aws_vpc" "main" {
        cidr_block = var.vpc_cidr
        tags = { Name = "phoenix-\${var.environment}" }
      }
      resource "aws_subnet" "app" {
        vpc_id = aws_vpc.main.id
        cidr_block = "10.20.1.0/24"
      }
      resource "aws_security_group" "app" { vpc_id = aws_vpc.main.id }
      resource "aws_instance" "app" {
        ami = "ami-0123456789abcdef0"
        subnet_id = aws_subnet.app.id
      }
      resource "aws_lb" "app" { subnets = [aws_subnet.app.id] }
      resource "aws_lb_target_group" "app" { port = 80 }
      resource "aws_ecs_cluster" "app" { name = "phoenix" }
      resource "aws_ecs_service" "app" { cluster = aws_ecs_cluster.app.id }
      resource "aws_iam_role" "app" { name = "phoenix-role" }
      resource "aws_s3_bucket" "artifacts" { bucket = "phoenix-demo-artifacts" }

      module "network" { source = "./modules/network" }
      data "aws_caller_identity" "current" {}
      output "vpc_id" { value = aws_vpc.main.id }
    `,
  },
];

describe('analyzeTerraform', () => {
  it('inventories supported resources, variables, modules, data sources, and outputs', async () => {
    const result = await analyzeTerraform(validFiles);

    expect(result.diagnostics).toEqual([]);
    expect(result.resources).toHaveLength(10);
    expect(result.resources.map((resource) => resource.type)).toContain('aws_vpc');
    expect(result.variables).toEqual(expect.arrayContaining(['environment', 'vpc_cidr']));
    expect(result.modules).toContain('network');
    expect(result.dataSources).toContain('aws_caller_identity.current');
    expect(result.outputs).toContain('vpc_id');
    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'aws_subnet.app', to: 'aws_vpc.main' }),
        expect.objectContaining({ from: 'aws_instance.app', to: 'aws_subnet.app' }),
      ]),
    );
    expect(result.hardcodedValues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'main.tf' })]),
    );
  });

  it('reports unsupported resources and source locators explicitly', async () => {
    const result = await analyzeTerraform([{
      path: 'unsupported.tf',
      content: 'resource "aws_neptune_cluster" "database" { engine = "neptune" }',
    }]);

    expect(result.resources).toHaveLength(0);
    expect(result.unsupported).toEqual([
      expect.objectContaining({ type: 'aws_neptune_cluster', name: 'database', line: 1 }),
    ]);
  });

  it('returns actionable diagnostics for invalid HCL', async () => {
    const result = await analyzeTerraform([{
      path: 'broken.tf',
      content: 'resource "aws_vpc" "main" { cidr_block = "10.0.0.0/16"',
    }]);

    expect(result.diagnostics).toEqual([
      expect.objectContaining({ path: 'broken.tf', severity: 'error' }),
    ]);
  });

  it('ignores non-Terraform files without hiding unsupported Terraform content', async () => {
    const result = await analyzeTerraform([
      { path: 'README.md', content: 'resource "aws_instance" "fake" {}' },
      { path: 'main.tf', content: 'resource "aws_unknown_resource" "fake" {}' },
    ]);

    expect(result.filesAnalyzed).toEqual(['main.tf']);
    expect(result.unsupported).toHaveLength(1);
  });
});
