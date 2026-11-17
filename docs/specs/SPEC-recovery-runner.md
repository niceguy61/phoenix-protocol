# Spec: `recovery-runner`

## Objective
승인된 blueprint를 먼저 local/mock runner에서 검증하고, 이후 명시된 AWS sandbox에서 Terraform recovery를 실행한다. 실행 로그, 리소스, cleanup을 recovery session에 연결한다.

## Execution Modes

- `mock`: Terraform lifecycle과 실패/cleanup evidence를 deterministic fixture로 재현한다.
- `aws-sandbox`: 전용 sandbox boundary에서 `init`, `validate`, `plan`, `apply`를 수행한다.

실제 AWS 모드는 sandbox account/role, region allowlist, budget, TTL, cleanup policy가 없으면 활성화하지 않는다.

## Lifecycle

`created → awaiting-approval → approved → running → verifying → completed|failed → cleanup-pending → cleaned|cleanup-failed`

## Behavior

- production account/role/region을 denylist 또는 explicit allowlist로 차단한다.
- temporary, least-privilege credentials만 사용한다.
- subprocess stdout/stderr와 command result를 redact 후 보존한다.
- 생성 resource와 cleanup 결과를 추적한다.
- 실패 시에도 verification 전후 evidence와 cleanup failure를 보존한다.
- retry는 idempotent 단계에 한해 사용하며 apply 재시도는 policy로 제한한다.

## Commands

- Type check: `npm run typecheck`
- Unit tests: `npm test -- recovery-runner`
- Mock recovery: `npm run recovery:mock -- --fixture demo-blocker`
- AWS sandbox recovery: `npm run recovery:aws -- --session <id>`

AWS command는 sandbox preflight와 approval token이 없으면 실행되지 않는다.

## Testing Strategy

- mock mode로 성공, plan failure, apply failure, partial cleanup, cleanup failure를 검증한다.
- approval state, target allowlist, credential redaction, TTL을 contract test한다.
- 실제 AWS 테스트는 명시적 opt-in과 sandbox preflight 후에만 수행한다.
- 실행 로그가 session과 commit SHA에 연결되는지 검사한다.

## Boundaries

- Always: explicit approval, sandbox target validation, temporary credentials, idempotent cleanup, evidence preservation
- Ask first: AWS account/role 연결, IAM policy, apply/destroy allowlist, 비용 한도
- Never: production apply, long-lived key 저장, approval 없는 Terraform execution, 실패 로그 삭제

## Success Criteria

- [ ] mock runner가 전체 lifecycle을 재현한다.
- [ ] AWS mode가 sandbox 외 target을 거부한다.
- [ ] 모든 실행 로그와 cleanup 결과가 session evidence로 남는다.
- [ ] 실패한 cleanup이 숨겨지지 않고 `cleanup-failed`로 보고된다.
