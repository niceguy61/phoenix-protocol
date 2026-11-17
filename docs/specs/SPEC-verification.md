# Spec: `verification`

## Objective
Terraform 실행 성공과 infrastructure/application recovery를 분리해 검증하고, 각 check의 실제 timestamp와 상태를 기록한다.

## Initial Checks

- Terraform apply completion
- required AWS resource existence
- ECS service stability
- ALB target health
- application HTTP health endpoint
- configured database connectivity

## Check Contract

```json
{
  "id":"http-health",
  "layer":"application",
  "required":true,
  "status":"passed|failed|skipped|unverified",
  "startedAt":"2026-11-17T00:00:00Z",
  "completedAt":"2026-11-17T00:00:03Z",
  "evidence":[],
  "message":"..."
}
```

## Behavior

- check별 required 여부와 실제 실행 timestamp를 기록한다.
- infrastructure layer와 application layer를 분리한다.
- database connectivity는 설정된 경우 required check로 실행하고, 미설정이면 `skipped`와 이유를 기록한다.
- required check가 하나라도 failed, unverified, 또는 잘못 설정되면 recovery success를 선언하지 않는다.
- Terraform apply success만으로 application recovery를 통과시키지 않는다.
- check 결과는 runner session과 commit SHA에 연결한다.

## Commands

- Type check: `npm run typecheck`
- Unit tests: `npm test -- verification`
- Mock verification: `npm run verify:mock -- --session <id>`
- AWS sandbox verification: `npm run verify:aws -- --session <id>`

## Testing Strategy

- 각 check의 pass, fail, skipped, unverified fixture를 사용한다.
- apply success + HTTP failure가 전체 recovery를 실패시키는지 검사한다.
- database 미설정 상태가 0점이나 성공으로 변환되지 않고 skipped로 유지되는지 검사한다.
- timestamp, evidence locator, required status가 report로 전달되는지 contract test한다.

## Boundaries

- Always: actual execution timestamp, required/optional 구분, skipped/unverified 보존, infrastructure/application 분리
- Ask first: 새로운 health check 종류, timeout/retry, database credential/connection policy
- Never: missing check를 pass로 변환, AI 응답으로 pass/fail 결정, apply success만으로 `RECOVERY VERIFIED` 표시

## Success Criteria

- [ ] 모든 configured required check의 결과가 기록된다.
- [ ] infrastructure와 application recovery가 별도로 표시된다.
- [ ] required check 전체 통과 시에만 recovery success가 된다.
- [ ] failed, skipped, unverified 상태가 숨겨지지 않는다.
