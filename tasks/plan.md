# Implementation Plan: Phoenix Protocol MVP

**Canonical Kiro spec:** `.kiro/specs/phoenix-protocol/requirements.md`, `design.md`, `tasks.md`

## Overview

구현 목표는 public GitHub의 Terraform 프로젝트를 immutable commit 기준으로 분석하고, dependency/risk evidence와 Recovery Blueprint를 만든 뒤, 먼저 local/mock runner에서 복구 흐름을 검증하고 최종적으로 AWS sandbox에서 실제 recovery proof를 수행하는 것이다.

NVIDIA NIM은 `ai-provider` adapter를 통해 risk analysis, blueprint suggestion, failure analysis, remediation suggestion을 보조한다. deterministic analyzer, runner, verifier가 사실과 성공 판정을 소유한다.

## Architecture Decisions

- 단일 저장소 구조를 사용한다. 불필요한 microservice 분리는 하지 않는다.
- `apps/web`은 Next.js console, `apps/api`는 Node.js REST API로 분리한다.
- `packages/contracts`에 모듈 간 JSON schema와 TypeScript type을 둔다.
- `packages/analyzer`는 Terraform 분석과 graph 변환을 deterministic하게 수행한다.
- `packages/recovery`는 blueprint, mock/AWS runner, verification, report를 담당한다.
- NIM credential은 `apps/api` 서버에서만 읽는다. 브라우저는 NIM endpoint와 API key를 알지 못한다.
- 첫 실행 경로는 local/mock이다. AWS sandbox는 preflight, account/role allowlist, TTL, budget, cleanup 정책이 준비된 뒤 활성화한다.
- `evidence`는 verified fact, inference, assumption, recommendation을 구분하는 공통 데이터 모델이다.
- 모든 recovery session은 repository commit SHA와 연결된다.

## Target Project Structure

```text
apps/
  web/                 Next.js console
  api/                 Node.js REST API
packages/
  contracts/           JSON schema and shared TypeScript types
  ai-provider/         NVIDIA NIM adapter and evaluation harness
  repository/          GitHub snapshot integration
  analyzer/            Terraform analysis and dependency graph
  recovery/            Blueprint, runner, verification, report
fixtures/
  terraform/           valid, blocker, unsupported Terraform projects
  nim/                 golden and adversarial model cases
  recovery/            mock runner execution traces
  reports/             expected JSON/HTML report outputs
tests/
  integration/         API and module contract tests
  e2e/                 Playwright vertical-slice tests
docs/
  prd.md
  spec.md
  specs/               approved module specs
.kiro/
  agents/              project agent definitions
  steering/            project steering rules
tasks/
  plan.md
  todo.md
```

## Task List

### Phase 1: Foundation and contracts

- Task 1: Scaffold the TypeScript workspace, API, web, shared packages, test scripts, and secret-safe `.gitignore`.
- Task 2: Define evidence, session, graph, finding, blueprint, execution, verification, and report contracts.
- Task 3: Implement the NVIDIA NIM adapter with server-only configuration and schema validation.

### Phase 1 Checkpoint

- Type check, unit test command, and build scripts execute.
- NIM adapter tests pass with a mock HTTP server.
- No test or application path reads or prints the value of `NVIDIA_API_KEY`.

### Phase 2: Deterministic analysis path

- Task 4: Implement public GitHub commit-pinned repository snapshot integration.
- Task 5: Implement Terraform resource/module/data/variable/output analysis.
- Task 6: Implement dependency graph generation and unresolved dependency reporting.
- Task 7: Implement deterministic recovery risk rules and NIM-assisted risk explanation.

### Phase 2 Checkpoint

- Demo Terraform fixture produces at least 10 supported resources.
- Intentional recovery blocker is found with source evidence.
- NIM unavailability does not remove deterministic findings.

### Phase 3: Recovery proof path

- Task 8: Implement Recovery Blueprint generation and explicit approval state.
- Task 9: Implement local/mock recovery runner lifecycle.
- Task 10: Implement verification engine, including optional/required database connectivity.
- Task 11: Implement canonical JSON and HTML evidence reports.

### Phase 3 Checkpoint

- Mock recovery success requires all configured required checks.
- Apply success with application health failure is not `RECOVERY VERIFIED`.
- Failed, skipped, unverified, and cleanup-failed states remain visible in reports.

### Phase 4: Console and evaluation

- Task 12: Implement REST orchestration endpoints and connect the Next.js console to real API responses.
- Task 13: Add Playwright vertical-slice coverage and NIM golden/adversarial evaluation reporting.
- Task 14: Add AWS sandbox preflight and adapter behind an explicit feature/configuration gate.

### Final Checkpoint

- Public GitHub → analysis → graph/risk → blueprint approval → mock recovery → verification → report works end to end.
- NIM evaluation results include model, prompt version, latency, response hash, schema, grounding, and safety verdicts.
- AWS sandbox mode remains disabled until its target and cleanup policy are explicitly configured.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| NIM output claims unsupported facts | High | deterministic evidence ownership, schema validation, verified/inferred separation, adversarial fixtures |
| Terraform syntax/provider coverage is incomplete | High | explicit unsupported diagnostics, fixture-first analyzer, no silent fallback |
| Mock path diverges from AWS behavior | High | shared execution/evidence contracts and later AWS adapter contract tests |
| AWS cleanup fails or incurs cost | High | sandbox allowlist, TTL, budget, idempotent cleanup, no default AWS mode |
| Secret leaks through browser/logs | High | server-only env access, redaction tests, `.env` ignored, no client-side NIM calls |
| Empty repository increases scaffold uncertainty | Medium | keep first slice narrow, validate every phase before expanding |

## Open Questions

- AWS sandbox credential source is the user's already-authenticated `default` AWS profile via SSO. The application must use the profile through the AWS SDK/CLI configuration and must not read or copy credential file contents.
- AWS sandbox를 별도 계정으로 둘지 기존 계정 내 전용 role/region/prefix로 둘지 구현 전에 결정한다.
- 첫 AWS fixture에서 DB connectivity를 required로 만들 resource 조합을 결정한다.
- private GitHub 연동은 public flow가 안정화된 뒤 별도 spec으로 확장한다.

## Verification Commands

- Install: `npm install`
- Type check: `npm run typecheck`
- Unit tests: `npm test`
- NIM evaluation: `npm run test:nim`
- E2E tests: `npm run test:e2e`
- Production build: `npm run build`
