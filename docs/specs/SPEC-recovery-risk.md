# Spec: `recovery-risk`

## Objective
deterministic analyzer evidence와 관리형 NVIDIA NIM reasoning을 결합해 복구를 막을 수 있는 위험을 분류한다. AI 판단은 evidence와 분리해 표시한다.

## Risk Categories

IAM permission, secret/encryption, container image, DNS/certificate, manually managed infrastructure, missing variable, unresolved dependency, external service를 초기 category로 지원한다.

## Finding Contract

```json
{
  "id":"risk_<id>",
  "severity":"critical|high|medium|low",
  "status":"verified|inferred|needs-evidence|resolved",
  "category":"missing-variable",
  "evidence": [{"source":"terraform","locator":"main.tf:12"}],
  "summary":"...",
  "recommendedAction":"..."
}
```

`verified`는 deterministic evidence가 직접 뒷받침하는 경우에만 사용한다. NIM은 `inferred` 또는 `needs-evidence`를 생성할 수 있지만 verified로 승격하지 못한다.

## Behavior

- deterministic rules를 먼저 실행한다.
- NIM에는 필요한 최소 evidence와 versioned prompt만 전달한다.
- NIM 응답 schema와 evidence locator를 검증한다.
- conflicting findings는 숨기지 않고 conflict diagnostic을 남긴다.
- NIM 장애 시 deterministic findings를 유지하고 AI portion을 unavailable로 기록한다.

## Commands

- Type check: `npm run typecheck`
- Unit tests: `npm test -- recovery-risk`
- NIM evaluation: `npm run test:nim -- --module recovery-risk`

## Testing Strategy

- 각 risk category별 deterministic fixture를 만든다.
- evidence 없는 NIM claim, 잘못된 severity, production apply 제안을 거부한다.
- golden/adversarial NIM fixture를 schema, grounding, uncertainty 기준으로 평가한다.
- 동일 input과 prompt version의 finding metadata 재현성을 검사한다.

## Boundaries

- Always: finding별 evidence, severity, uncertainty, recommended action 기록
- Ask first: severity threshold 변경, AI가 verified status를 제안할 수 있는지 여부
- Never: NIM claim을 실행 evidence로 위장, evidence 없는 risk를 verified로 표시, finding 삭제로 score 개선

## Success Criteria

- [ ] blocker가 관련 resource/file locator와 함께 발견된다.
- [ ] Critical/High/Medium/Low 분류가 schema를 통과한다.
- [ ] AI assumption과 verified fact가 화면과 report에서 분리된다.
- [ ] NIM 없이도 deterministic risk 분석이 동작한다.
