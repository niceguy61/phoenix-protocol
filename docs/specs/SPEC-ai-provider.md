# Spec: `ai-provider`

## Objective
관리형 NVIDIA NIM endpoint를 상위 모듈에서 안전하게 사용할 수 있는 provider adapter를 만든다. AI 응답은 분석 결과를 보조하지만 recovery 성공 여부를 결정하지 않는다.

## Confirmed Configuration

- Base URL: `https://integrate.api.nvidia.com/v1`
- Model: `z-ai/glm-5.3-flash`
- API key: `NVIDIA_API_KEY` 서버 환경 변수 또는 secret provider에서만 주입
- API surface: OpenAI-compatible chat completion adapter

## Contract

입력은 구조화된 analysis/evidence payload와 versioned prompt다. 출력은 schema-validated JSON이다.

```json
{
  "facts": [],
  "assumptions": [],
  "recommendations": [],
  "needsEvidence": [],
  "model": "z-ai/glm-5.3-flash",
  "promptVersion": "risk-v1"
}
```

`facts`는 입력 evidence에 존재하는 내용만 포함한다. 모델이 판단한 내용은 `assumptions` 또는 `recommendations`로 분리한다.

## Behavior

- timeout과 bounded retry를 적용한다.
- retry 대상은 rate limit과 일시적 5xx뿐이다.
- invalid JSON/schema 응답은 성공으로 취급하지 않는다.
- 요청 및 응답 로그에서 API key, secret, private key, token을 redact한다.
- model, prompt version, request id, latency, response hash를 evidence metadata로 기록한다.
- provider 오류는 상위 모듈이 `ai-unavailable` 상태로 처리할 수 있도록 typed error로 반환한다.
- NIM 결과만으로 verified recovery, required check pass, AWS resource 존재를 주장하지 않는다.

## Commands

- Type check: `npm run typecheck`
- Unit tests: `npm test -- ai-provider`
- NIM evaluation: `npm run test:nim -- --module ai-provider`

## Testing Strategy

- mock HTTP server로 timeout, 429, 5xx, malformed JSON, schema failure를 검증한다.
- golden fixture로 risk/blueprint/failure-analysis 응답의 schema와 evidence grounding을 평가한다.
- adversarial fixture로 production apply, credential 요청, evidence 없는 성공 주장을 거부하는지 평가한다.
- live NIM 호출은 opt-in 명령에서만 실행하고 API key가 없으면 명확히 skip한다.

## Boundaries

- Always: API key 서버 보관, schema validation, response redaction, request metadata 기록
- Ask first: 모델 변경, base URL 변경, prompt contract 변경, retry/timeout 정책 변경
- Never: 브라우저에서 NIM 직접 호출, raw credential 로그 기록, AI 응답을 실행 명령으로 직접 사용

## Success Criteria

- [ ] 지정된 base URL과 model을 사용한다.
- [ ] 모든 성공 응답이 schema validation을 통과한다.
- [ ] malformed/schema-invalid 응답은 실패로 분류된다.
- [ ] evidence 없는 AI 주장은 verified fact로 승격되지 않는다.
- [ ] NIM 장애가 deterministic 분석과 검증을 중단시키지 않고 명시적 상태로 남는다.
