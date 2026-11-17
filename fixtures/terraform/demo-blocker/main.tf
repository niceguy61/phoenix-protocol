variable "environment" {
  default = "demo"
}

resource "aws_vpc" "main" {
  cidr_block = "10.30.0.0/16"
}

resource "aws_ecs_cluster" "app" {
  name = "phoenix-${var.environment}"
}

resource "aws_ecs_service" "app" {
  cluster = aws_ecs_cluster.app.id
  image = "private.example.invalid/phoenix:missing"
  certificate_arn = "arn:aws:acm:ap-northeast-2:000000000000:certificate/missing"
}

resource "aws_neptune_cluster" "unsupported" {
  engine = "neptune"
}
