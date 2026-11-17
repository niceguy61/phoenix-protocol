# Phoenix Protocol Spec

**Status:** Kiro-native spec ready for implementation  
**Source:** [`docs/prd.md`](./prd.md)  
**Canonical:** `.kiro/specs/phoenix-protocol/requirements.md`, `design.md`, `tasks.md`  
**Reference modules:** `docs/specs/`  
**Project:** Kiroween 2026  
**Last updated:** 2026-11-17

## 0. Scope Gate

`docs/prd.md`는 저장소 연동, Terraform 분석, 그래프, AI 위험 분석, 복구 실행, 검증, 리포트, 웹 콘솔처럼 독립적으로 테스트할 수 있는 기능을 하나의 제품 요구사항으로 묶고 있다. Kiro의 표준 spec 구조에 맞춰 구현 기준을 `.kiro/specs/phoenix-protocol/`에 정리했다.

`requirements.md`는 요구사항과 acceptance criteria, `design.md`는 모듈 경계와 아키텍처, `tasks.md`는 구현 순서와 verification gate를 소유한다. `docs/specs/`와 `tasks/`의 기존 문서는 사람이 읽기 위한 상세 reference와 호환용 계획으로 유지한다.

## 1. Objective

Phoenix Protocol은 Terraform으로 정의된 AWS 인프라를 실제로 처음부터 복구할 수 있는지 검증하는 플랫폼이다. MVP의 성공 기준은 정적 분석 결과가 아니라 다음 전체 흐름을 재현 가능한 증거로 남기는 것이다.

> public GitHub repository → Terraform analysis → dependency/risk evidence → recovery blueprint → isolated rebuild → infrastructure/application verification → recovery evidence report

AI는 위험 분석, 복구 계획, 실패 원인 분석을 보조한다. 실제 복구 가능 여부와 성공 판정은 Terraform 실행 결과와 검증 결과 같은 실행 증거만 결정한다.

## 2. Confirmed Decisions

1. 초기 MVP의 대상은 AWS Terraform 프로젝트이며, 다른 클라우드와 Kubernetes는 범위에서 제외한다.
2. 초기 repository 연동은 public GitHub부터 시작하고 private repository는 후속 범위로 둔다.
3. NVIDIA NIM은 관리형 inference provider로 사용한다.
4. NIM base URL은 `https://integrate.api.nvidia.com/v1`, model은 `z-ai/glm-5.3-flash`로 고정한다.
5. NIM은 `ai-provider` adapter 뒤에 배치하고, deterministic analyzer와 recovery verifier는 NIM 응답에 의존하지 않는다.
6. NIM 평가 대상은 risk analysis, Recovery Blueprint, 실행 실패 분석, remediation suggestion이다. Terraform 파싱·dependency extraction·실행·health check는 별도의 deterministic test fixture로 검증한다.
7. 첫 vertical slice는 local/mock runner로 계약과 전체 흐름을 검증한다. 이후 사용자가 보유한 AWS 계정에 별도 sandbox 경계를 구성하고 실제 apply/recovery 검증을 추가한다.
8. AWS sandbox 단계에서는 AWS 계정, 전용 계정 또는 명시적 sandbox 경계, least-privilege IAM, 비용 한도, cleanup 정책을 먼저 확정한다.
9. MVP verification은 설정된 경우 database connectivity check도 지원한다. demo에서는 데이터베이스 사용 여부에 따라 required 또는 skipped를 명시한다.
10. PRD의 Next.js, Node.js, PostgreSQL, Terraform CLI, Vitest, Playwright 스택을 기본값으로 유지한다. 구현 단계에서 실제 scaffold를 확인한 뒤 명령을 확정한다.

## 3. Capability Map

| Module ID | Responsibility | MVP | Depends on |
|---|---|---:|---|
| `ai-provider` | NIM을 포함한 모델 provider adapter, timeout/retry, structured-output 검증, prompt/response trace redaction | Yes | — |
| `repository-integration` | GitHub repository/branch/root-module 선택, source snapshot, commit SHA 고정 | Yes | — |
| `terraform-analysis` | HCL/Terraform 분석, resource inventory, module/data/variable/output dependency extraction, unsupported construct 보고 | Yes | `repository-integration` |
| `dependency-graph` | 분석 결과를 directed graph JSON으로 변환하고 외부·미해결 dependency를 표시 | Yes | `terraform-analysis` |
| `recovery-risk` | deterministic evidence와 NIM reasoning을 결합해 risk finding, severity, evidence, action을 생성 | Yes | `terraform-analysis`, `dependency-graph`, `ai-provider` |
| `recovery-blueprint` | dependency order 기반 복구 단계, 변수·권한·외부 prerequisite, expected outcome 생성 | Yes | `recovery-risk`, `ai-provider` |
| `recovery-runner` | 승인된 blueprint를 격리된 sandbox에서 Terraform init/validate/plan/apply로 실행하고 로그·cleanup을 관리 | Yes | `repository-integration`, `recovery-blueprint` |
| `verification` | Terraform, AWS resource, ECS/ALB, HTTP health, DB connectivity 검증과 required/failed/skipped 상태 기록 | Yes | `recovery-runner` |
| `evidence-report` | 실행 증거, 그래프, 위험, blueprint, 검증 결과, duration, RTO 비교를 JSON/HTML로 내보냄 | Yes | `dependency-graph`, `recovery-risk`, `recovery-blueprint`, `recovery-runner`, `verification` |
| `readiness-score` | 검증된 evidence만 사용해 Recovery Readiness Score를 계산하고 근거를 표시 | Should | `evidence-report` |
| `ai-remediation` | 실패 증거 기반 Terraform 수정 제안과 설명을 생성하고 validation 후 PR 후보를 만듦 | Should | `verification`, `ai-provider`, `repository-integration` |
| `web-console` | repository 선택, graph, risk, blueprint approval, execution timeline, verification, report UI | Yes | `repository-integration`, `dependency-graph`, `recovery-risk`, `recovery-blueprint`, `recovery-runner`, `verification`, `evidence-report` |

### Dependency direction

```text
ai-provider ─────────────────────────────────────────────┐
                                                         │
repository-integration → terraform-analysis → dependency-graph
                                      │              │
                                      └──────────────┴→ recovery-risk
                                                         │
                                                         └→ recovery-blueprint
repository-integration + recovery-blueprint → recovery-runner → verification
                                                          │            │
                                                          └────────────┴→ evidence-report → readiness-score
verification + ai-provider + repository-integration → ai-remediation

위 모듈들의 API를 소비하는 web-console은 각 모듈의 결과를 표시하고 승인 흐름을 호출한다.
```

순환 의존성은 허용하지 않는다. 모듈 간 계약은 provider 모듈의 spec에서 정의하고, UI는 내부 구현이 아니라 API 계약만 소비한다.

## 4. Proposed Build Order

1. `ai-provider`와 공통 evidence/contract 정의
2. `repository-integration`의 commit-pinned source snapshot
3. `terraform-analysis`와 지원 resource fixture
4. `dependency-graph` JSON 및 unresolved dependency 표현
5. `recovery-risk`의 deterministic rule + NVIDIA NIM 평가 경로
6. `recovery-blueprint` 생성과 사용자 승인 계약
7. `recovery-runner`의 local/mock 실행 계약, 이후 AWS sandbox adapter
8. `verification`과 infrastructure/application recovery 분리 판정
9. `evidence-report` 및 선택적 `readiness-score`
10. 위 vertical slice를 연결하는 `web-console`
11. `ai-remediation`과 GitHub PR 후보 생성

첫 번째 vertical slice는 의도적으로 recovery blocker를 포함한 public GitHub Terraform demo를 대상으로 한다. 전체 AWS resource coverage보다 이 흐름을 먼저 끝까지 검증한다.

## 5. NVIDIA NIM Test Strategy

### Provider configuration

- `NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1`
- `NVIDIA_MODEL=z-ai/glm-5.3-flash`
- `NVIDIA_API_KEY`는 서버 프로세스의 secret/environment boundary에서만 주입한다.
- 브라우저와 저장소에는 API key를 전달하지 않는다.
- NIM 호출은 OpenAI-compatible chat completion adapter로 격리하고, provider 교체가 상위 모듈 계약을 바꾸지 않도록 한다.
- 요청/응답 trace에는 credential과 민감한 입력을 redact하고 model, prompt version, request id, latency, response hash만 보존한다.

### 실행 순서

1. local/mock runner로 fixture, API 계약, evidence lifecycle을 검증한다.
2. NIM golden/adversarial fixture 평가를 실행한다.
3. AWS sandbox adapter를 추가한 뒤 실제 Terraform apply와 verification을 수행한다.
4. mock 결과와 AWS 결과를 같은 evidence schema로 비교한다.

### NIM이 담당하는 영역

- recovery risk finding의 분류·설명·recommended action
- 분석 결과를 바탕으로 한 Recovery Blueprint 초안
- Terraform 실행/verification failure의 root-cause explanation
- remediation suggestion 초안

### NIM이 담당하지 않는 영역

- Terraform 파싱과 resource relationship 추출
- commit SHA, 파일 위치, line range 같은 evidence의 사실성
- Terraform 명령 실행 및 AWS resource 상태 조회
- required check의 pass/fail 판정
- production 또는 sandbox 인프라에 대한 직접 변경

### 평가 기준

각 NIM 응답은 JSON schema를 통과해야 하며, 다음을 별도로 평가한다.

- **Schema validity:** 필수 필드, enum severity, step ordering, unknown 상태 처리
- **Evidence grounding:** 파일·resource·실행 로그에 없는 사실을 verified fact로 주장하지 않음
- **Separation:** verified fact, inference, assumption, recommendation을 구분함
- **Safety:** production target, long-lived credential, 무승인 apply를 제안하거나 실행하지 않음
- **Failure behavior:** 불충분한 입력에서 성공으로 추론하지 않고 `unknown` 또는 `needs-evidence`를 반환함
- **Reproducibility:** 고정 fixture, 고정 prompt version, 모델 식별자, temperature/seed 및 raw response hash를 기록함

NIM 평가는 golden fixture와 adversarial fixture를 함께 사용한다. deterministic contract test가 실패하면 NIM 평가 결과와 무관하게 해당 기능은 실패로 처리한다.

## 6. MVP Acceptance Boundary

MVP spec은 다음 흐름을 실제 증거로 입증하는 것을 목표로 한다.

- [ ] public GitHub repository와 branch/root module을 선택할 수 있다.
- [ ] 분석 대상 commit SHA가 고정되고 source snapshot과 함께 기록된다.
- [ ] PRD의 초기 지원 AWS resource 중 최소 10종을 inventory로 표현한다.
- [ ] resource/module/data/variable/output dependency가 directed JSON graph로 표현된다.
- [ ] 의도적으로 삽입한 recovery blocker가 파일/resource evidence와 함께 발견된다.
- [ ] NIM이 생성한 risk와 blueprint는 schema를 통과하고 verified fact와 suggestion을 구분한다.
- [ ] 사용자의 명시적 approval 없이 sandbox provisioning이 시작되지 않는다.
- [ ] recovery runner가 실행 로그, 생성 리소스, 실패 상태, cleanup 결과를 session에 연결한다.
- [ ] Terraform apply 성공만으로 recovery 성공을 선언하지 않는다.
- [ ] infrastructure check와 application health check가 모두 required 조건을 통과해야 `RECOVERY VERIFIED`가 된다.
- [ ] 실패·skipped·unverified 상태가 report에서 숨겨지지 않는다.
- [ ] report의 모든 성공/실패 지표가 실제 execution evidence를 참조한다.

## 7. Security and Operational Boundaries

### Always

- NIM과 외부 API의 credential은 서버 측 환경/secret boundary에서만 관리한다.
- 모든 AI finding에 evidence와 confidence/uncertainty 상태를 함께 기록한다.
- recovery execution은 production target을 기본값으로 허용하지 않는다.
- 실행 로그와 report에서 token, secret, private key를 redact한다.
- cleanup은 idempotent하게 설계하고 실패도 evidence로 보존한다.
- major feature에는 deterministic test와 필요한 경우 NIM evaluation fixture를 둔다.

### Ask first

- 실제 AWS sandbox 계정 연결, IAM policy, 비용 한도, resource cleanup 범위 변경
- private GitHub OAuth/App 연동
- database schema 또는 migration 변경
- 새로운 external provider/dependency 추가
- production account 또는 production-like resource 접근
- PR 자동 생성/branch push 권한 부여

### Never

- production credentials를 recovery runner에서 사용하지 않는다.
- AI 응답만으로 verified recovery 또는 successful health를 표시하지 않는다.
- 사용자의 approval 없이 Terraform apply/destroy를 실행하지 않는다.
- long-lived AWS/GitHub/NIM credential을 저장소, 브라우저, 로그에 노출하지 않는다.
- 실패한 check를 삭제하거나 성공으로 변환해 score/report를 높이지 않는다.
- unsupported Terraform construct를 지원한다고 조용히 가장하지 않는다.

## 8. Resolved Decisions

- NIM endpoint: `https://integrate.api.nvidia.com/v1`
- NIM model: `z-ai/glm-5.3-flash`
- NIM hosting: managed NVIDIA endpoint
- First execution mode: local/mock runner
- AWS credential source: the authenticated `default` AWS profile via SSO; credential contents never enter the application, browser, or logs
- AWS execution: required for the final recovery proof, after sandbox/IAM/cost/cleanup boundary is defined
- Database connectivity: supported in MVP verification and marked required or skipped according to project configuration
- Capability map: approved as written in this document

## 9. Kiro Spec Mapping

Kiro-native canonical files:

- `.kiro/specs/phoenix-protocol/requirements.md`
- `.kiro/specs/phoenix-protocol/design.md`
- `.kiro/specs/phoenix-protocol/tasks.md`

Reference files:

- `docs/specs/SPEC-<module-id>.md`: module-level detail
- `tasks/plan.md`: dependency graph and phase plan
- `tasks/todo.md`: compatibility checklist for task-runner and review
- `tasks/kiro-local-mvp.md`: local/mock Task Runner execution scope

Kiro Task Runner는 `.kiro/specs/phoenix-protocol/tasks.md` 또는 별도의 실행 spec을 받아 작업을 수행할 수 있다. 실제 AWS sandbox 확장은 local/mock gate와 별도 승인을 통과한 뒤 실행한다.
