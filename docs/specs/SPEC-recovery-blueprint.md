# Spec: `recovery-blueprint`

## Objective
분석 graph와 risk를 바탕으로 격리 환경에서 실행 가능한 ordered recovery plan을 생성하고, 각 단계의 outcome과 prerequisite를 명시한다.

## Blueprint Contract

```json
{
  "steps": [{
    "id":"step-01",
    "kind":"terraform-validate",
    "dependsOn":[],
    "requiredInputs":[],
    "expectedOutcome":"...",
    "approvalRequired":false
  }],
  "externalDependencies": [],
  "estimatedDurationSeconds": 0,
  "verificationPlan": []
}
```

## Behavior

- graph prerequisite order를 위반하지 않도록 step을 정렬한다.
- required variables, permissions, external dependencies를 분리한다.
- 각 step에 expected outcome과 failure evidence를 정의한다.
- AI가 제안한 step은 `suggested` 상태로 시작하며 실행 전에 contract validation을 통과해야 한다.
- provisioning/apply 단계는 명시적 사용자 approval을 요구한다.
- 예상 시간은 estimate로 표시하고 실제 duration과 혼동하지 않는다.

## Commands

- Type check: `npm run typecheck`
- Unit tests: `npm test -- recovery-blueprint`
- NIM evaluation: `npm run test:nim -- --module recovery-blueprint`

## Testing Strategy

- dependency graph ordering, missing prerequisite, cycle, unknown variable fixture를 사용한다.
- NIM이 생성한 blueprint의 step schema, ordering, evidence reference를 검증한다.
- approval 없는 apply step이 runner로 전달되지 않는지 검사한다.
- expected outcome 없는 step과 실행 불가능한 command를 거부한다.

## Boundaries

- Always: dependency order, required input, expected outcome, approval state 기록
- Ask first: 실제 AWS sandbox target, Terraform destroy 정책, 비용이 발생하는 resource 허용 목록
- Never: blueprint 생성만으로 recovery success 판정, AI가 자동으로 apply/destroy 실행, production target을 default로 사용

## Success Criteria

- [ ] blueprint가 분석 결과에서 생성된다.
- [ ] 모든 step에 outcome과 dependency가 있다.
- [ ] 외부 prerequisite와 required input이 명시된다.
- [ ] 사용자 approval 이전에 provisioning step이 실행되지 않는다.
