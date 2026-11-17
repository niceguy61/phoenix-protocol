variable "environment" {
  default = "demo"
}

variable "vpc_cidr" {
  default = "10.20.0.0/16"
}

resource "aws_vpc" "main" {
  cidr_block = var.vpc_cidr
  tags = { Name = "phoenix-${var.environment}" }
}

resource "aws_subnet" "app" {
  vpc_id = aws_vpc.main.id
  cidr_block = "10.20.1.0/24"
}

resource "aws_security_group" "app" {
  vpc_id = aws_vpc.main.id
}

resource "aws_instance" "app" {
  ami = "ami-0123456789abcdef0"
  subnet_id = aws_subnet.app.id
}

resource "aws_lb" "app" {
  subnets = [aws_subnet.app.id]
}

resource "aws_lb_target_group" "app" {
  port = 80
}

resource "aws_ecs_cluster" "app" {
  name = "phoenix"
}

resource "aws_ecs_service" "app" {
  cluster = aws_ecs_cluster.app.id
}

resource "aws_iam_role" "app" {
  name = "phoenix-role"
}

resource "aws_s3_bucket" "artifacts" {
  bucket = "phoenix-demo-artifacts"
}

module "network" {
  source = "./modules/network"
}

data "aws_caller_identity" "current" {}

output "vpc_id" {
  value = aws_vpc.main.id
}
