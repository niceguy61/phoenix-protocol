# DynamoDB Smoke Test Runbook

This runbook is for an operator who explicitly wants to run the real AWS mutation outside the Kiro agent execution boundary.

## Scope

- AWS profile: `default` SSO profile
- Region: `ap-northeast-2`
- Table name: one unique `phoenix-smoke-*` name generated for this run
- Billing mode: `PAY_PER_REQUEST`
- Key: `id` with type `S`
- Existing DynamoDB tables: never imported, updated, or deleted

## Preflight

Run the following read-only checks first:

```powershell
aws sts get-caller-identity --profile default
aws dynamodb list-tables --profile default --region ap-northeast-2
```

Choose a unique table name, for example:

```powershell
$tableName = "phoenix-smoke-$(Get-Date -Format yyyyMMdd-HHmmss)"
```

Stop if the table already exists or the account/region is not the intended target.

## Create one smoke table

```powershell
aws dynamodb create-table `
  --profile default `
  --region ap-northeast-2 `
  --table-name $tableName `
  --attribute-definitions AttributeName=id,AttributeType=S `
  --key-schema AttributeName=id,KeyType=HASH `
  --billing-mode PAY_PER_REQUEST `
  --tags Key=Project,Value=phoenix-protocol Key=Purpose,Value=smoke-test Key=ManagedBy,Value=phoenix-protocol
```

Wait until it is active:

```powershell
aws dynamodb wait table-exists `
  --profile default `
  --region ap-northeast-2 `
  --table-name $tableName
```

Verify only the exact table created by this run:

```powershell
aws dynamodb describe-table `
  --profile default `
  --region ap-northeast-2 `
  --table-name $tableName
```

## Cleanup

Delete only the exact value stored in `$tableName`. Never use a prefix, wildcard, or loop over all tables.

```powershell
aws dynamodb delete-table `
  --profile default `
  --region ap-northeast-2 `
  --table-name $tableName
```

Confirm deletion:

```powershell
aws dynamodb wait table-not-exists `
  --profile default `
  --region ap-northeast-2 `
  --table-name $tableName
```

If cleanup fails, stop and resolve the exact table manually. Do not broaden the target.

## Agent boundary

The agent can implement and test the preflight/plan logic and run read-only AWS checks. The actual `create-table` and `delete-table` commands must be run by an operator in a terminal that has the intended SSO session.
