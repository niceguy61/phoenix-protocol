# Spec: `evidence-report`

## Objective
recovery session의 source, graph, risk, blueprint, execution, verification을 실제 evidence와 함께 JSON 및 HTML report로 제공한다.

## Report Contents

- repository, branch, immutable commit SHA, snapshot identity
- infrastructure inventory and dependency graph
- recovery risks with evidence and uncertainty
- Recovery Blueprint and approval record
- execution timeline, logs metadata, resource lifecycle
- verification results including failed/skipped/unverified checks
- actual recovery duration and estimated RTO comparison
- remediation recommendations marked as suggestions

## Contract

```json
{
  "sessionId":"session_<id>",
  "status":"recovery-verified|failed|unverified",
  "source": {"commitSha":"..."},
  "execution": {"startedAt":"...","completedAt":"...","durationSeconds":0},
  "verification": {"requiredPassed":0,"requiredTotal":0,"checks":[]},
  "evidenceRefs": [],
  "generatedAt":"..."
}
```

## Behavior

- 모든 headline metric에 source evidence reference를 연결한다.
- 실제 duration과 blueprint estimate를 구분한다.
- failed, skipped, unverified를 report에서 제거하지 않는다.
- JSON export는 machine-readable canonical output이다.
- HTML export는 JSON 결과를 표현하며 결과를 재계산하거나 낙관적으로 보정하지 않는다.
- report generation 실패 시 partial evidence와 오류를 별도로 보존한다.

## Commands

- Type check: `npm run typecheck`
- Unit tests: `npm test -- evidence-report`
- Report fixture test: `npm run test:fixtures -- evidence-report`
- HTML render test: `npm run test:report -- evidence-report`

## Testing Strategy

- complete, failed, partial cleanup, skipped database, unverified required check fixture를 사용한다.
- report JSON schema와 evidence reference completeness를 검증한다.
- HTML이 JSON과 동일한 status와 counts를 보여주는지 비교한다.
- AI suggestion이 verified result 영역에 섞이지 않는지 검사한다.

## Boundaries

- Always: canonical JSON, evidence references, actual-vs-estimate 구분, 실패 상태 보존
- Ask first: report retention, public sharing, additional export format, score policy
- Never: evidence 없는 metric 생성, failed check 삭제, HTML 표현을 위해 canonical result 변경

## Success Criteria

- [ ] 모든 completed recovery session에 report가 생성된다.
- [ ] JSON과 HTML이 동일한 canonical status를 표현한다.
- [ ] 실제 실행 증거 없는 성공 지표가 없다.
- [ ] failed/skipped/unverified 결과가 사용자에게 보인다.
