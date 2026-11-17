terraform {
  required_version = ">= 1.14.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  type        = string
  description = "AWS region used for the smoke test"
  default     = "ap-northeast-2"
}

variable "table_name" {
  type        = string
  description = "Unique table name for this smoke test"

  validation {
    condition     = can(regex("^phoenix-smoke-tf-[a-z0-9-]+$", var.table_name))
    error_message = "table_name must start with phoenix-smoke-tf- and contain lowercase letters, numbers, or hyphens."
  }
}

resource "aws_dynamodb_table" "smoke" {
  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Project   = "phoenix-protocol"
    Purpose   = "terraform-smoke-test"
    ManagedBy = "terraform"
  }
}

output "table_name" {
  value = aws_dynamodb_table.smoke.name
}

output "table_arn" {
  value = aws_dynamodb_table.smoke.arn
}
