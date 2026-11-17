# Terraform DynamoDB Smoke Test

This fixture creates exactly one pay-per-request DynamoDB table in `ap-northeast-2` and scopes the name to `phoenix-smoke-tf-*`.

The fixture does not import or manage existing tables.

## Validate locally

```powershell
terraform init -backend=false
terraform validate
```

## Plan against the selected AWS profile

Run from this directory after copying `terraform.tfvars.example` to `terraform.tfvars`:

```powershell
$env:AWS_PROFILE = "default"
terraform plan -var-file=terraform.tfvars
```

## Create and verify

```powershell
$env:AWS_PROFILE = "default"
terraform apply -var-file=terraform.tfvars
terraform output
```

## Destroy only this Terraform-managed table

```powershell
$env:AWS_PROFILE = "default"
terraform destroy -var-file=terraform.tfvars
```

Do not run `terraform destroy` from another directory or against another state file. The generated `terraform.tfstate` is local and ignored by Git. Confirm the table name in the plan before applying or destroying.
