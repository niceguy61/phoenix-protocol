# Spec: `terraform-analysis`

## Objective
commit-pinned Terraform source를 deterministic하게 분석해 resource inventory, dependency metadata, variables/outputs, external prerequisites, unsupported construct를 생성한다.

## Initial Resource Scope

`aws_vpc`, `aws_subnet`, `aws_security_group`, `aws_instance`, `aws_lb`, `aws_lb_target_group`, `aws_ecs_cluster`, `aws_ecs_service`, `aws_iam_role`, `aws_iam_policy`, `aws_db_instance`, `aws_s3_bucket`, `aws_kms_key`, `aws_secretsmanager_secret`를 우선 지원한다.

## Output Contract

```json
{
  "resources": [],
  "modules": [],
  "dataSources": [],
  "variables": [],
  "outputs": [],
  "dependencies": [],
  "unsupported": [],
  "diagnostics": []
}
```

각 resource와 dependency는 파일 경로와 line range를 evidence locator로 가져야 한다. 파싱되지 않은 항목은 누락하지 않고 `unsupported` 또는 `diagnostics`에 기록한다.

## Behavior

- HCL/Terraform syntax와 module 구조를 분석한다.
- resource reference, implicit dependency, explicit `depends_on`을 추출한다.
- variable/default/required 상태와 output reference를 추출한다.
- data source와 외부 prerequisite 후보를 구분한다.
- hardcoded region, account, AMI, image, certificate, DNS, secret reference 후보를 flag한다.
- AI 호출 없이 동일 입력에 동일한 결과를 생성한다.

## Commands

- Type check: `npm run typecheck`
- Unit tests: `npm test -- terraform-analysis`
- Fixture tests: `npm run test:fixtures -- terraform-analysis`

## Testing Strategy

- 최소 10개 지원 AWS resource를 포함하는 valid fixture를 사용한다.
- malformed HCL, missing variable, unsupported provider/resource, nested module fixture를 사용한다.
- resource relationship, line range, explicit/implicit dependency가 정확한지 snapshot/contract test로 확인한다.
- analyzer가 unsupported construct를 조용히 지원한다고 보고하지 않는지 검사한다.

## Boundaries

- Always: deterministic output, source locator, unsupported 상태 보존, secret value 비노출
- Ask first: 추가 Terraform provider, state file 접근, provider schema download 정책
- Never: AI 추론으로 파싱 결과 보정, 존재하지 않는 resource를 inventory에 추가, secret 값을 분석 output에 저장

## Success Criteria

- [ ] 유효한 demo Terraform 프로젝트를 분석한다.
- [ ] 초기 지원 resource 중 최소 10종을 inventory로 표현한다.
- [ ] dependency와 source location이 구조화된 JSON으로 반환된다.
- [ ] unsupported/error가 actionable diagnostic으로 반환된다.
