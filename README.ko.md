# Phoenix Protocol

[![English README](https://img.shields.io/badge/README-English-3b82f6)](README.md)
[![Kiro로 개발](https://img.shields.io/badge/Built%20with-Kiro-6c47ff)](https://kiro.dev/)
[![Kiro Crew workflow](https://img.shields.io/badge/Workflow-Kiro%20Crew-111827)](https://kiro.dev/)
[![Status: Prototype](https://img.shields.io/badge/Status-Prototype-f59e0b)](#status)

> 인프라가 다시 일어설 수 있음을 증명합니다.

Phoenix Protocol은 Terraform으로 정의된 인프라를 실제로 복구할 수 있는지 검증하는 evidence-first 플랫폼입니다. Terraform을 분석하고, 복구 의존성을 찾고, Recovery Blueprint를 생성하고, 격리된 환경에서 재구축을 실행하고, 인프라와 애플리케이션 상태를 검증한 뒤 증거 보고서를 생성합니다.

정적 분석은 위험을 찾을 수 있습니다. 복구 실행과 필수 health check 통과만이 복구 가능성을 증명할 수 있습니다.

## Status

현재 active prototype 단계입니다. 초기 foundation과 managed NVIDIA NIM smoke test가 구현되어 있으며, 다음 구현 단계는 public GitHub commit-pinned snapshot과 deterministic Terraform analysis입니다.

현재 실행 경로는 local/mock입니다. AWS sandbox 실행은 계정, role, region, 비용, TTL, cleanup 경계를 설정하고 승인할 때까지 의도적으로 차단됩니다.

## MVP workflow

```text
Public GitHub repository
  → Commit-pinned Terraform snapshot
  → Deterministic analysis
  → Dependency graph와 recovery risk
  → Recovery Blueprint
  → 명시적 승인
  → Local/mock recovery 실행
  → 인프라 및 애플리케이션 검증
  → JSON/HTML evidence report
```

## NVIDIA NIM 평가

AI reasoning은 서버 전용 provider adapter 뒤에 격리되어 있습니다. 현재 평가 대상은 다음과 같습니다.

- Base URL: `https://integrate.api.nvidia.com/v1`
- Model: `z-ai/glm-5.3-flash`
- 평가 항목: schema validity, evidence grounding, uncertainty 분리, safety, failure handling

API key는 로컬 환경 파일이나 secret provider에서만 관리해야 합니다. `.env`를 commit하거나 `NVIDIA_API_KEY`를 출력하거나 browser 코드로 전달하지 않습니다.

## Development

필요 환경:

- Node.js 22 이상
- npm
- recovery-analysis 단계의 Terraform CLI
- opt-in live smoke test용 managed NVIDIA NIM API key

의존성을 설치하고 deterministic 검사를 실행합니다.

```bash
npm install
npm run typecheck
npm test
npm run build
```

API key를 출력하지 않고 opt-in live NIM smoke test를 실행합니다.

```bash
node --env-file=.env node_modules/vitest/vitest.mjs run tests/nim/live.test.ts
```

기본 테스트는 mock NIM 응답을 사용하므로 API key가 없어도 실행됩니다.

## Project structure

```text
.kiro/specs/phoenix-protocol/   Kiro native requirements, design, tasks
.kiro/steering/                  Kiro가 로드하는 프로젝트 규칙
.kiro/agents/                    프로젝트 agent 정의
docs/                            PRD 및 모듈 reference spec
apps/web/                        Next.js console
apps/api/                        서버 전용 API 경계
packages/contracts/              공통 evidence 및 lifecycle schema
packages/ai-provider/            NVIDIA NIM adapter 및 평가
fixtures/                        Terraform, NIM, recovery, report fixture
tests/                            integration, E2E, live evaluation test
tasks/                            호환용 plan 및 Task Runner spec
```

## Kiro 개발 workflow

이 프로젝트는 **Kiro**와 **Kiro Crew**로 개발합니다.

- 요구사항, 아키텍처, 구현 task는 `.kiro/specs/phoenix-protocol/`의 Kiro native spec에서 관리합니다.
- steering file은 evidence-first testing과 security boundary를 강제합니다.
- Kiro Crew Task Runner로 구조화된 구현 단위를 실행합니다.
- console UI가 scaffold 단계를 지나 product design 단계에 들어가면 Figma MCP를 사용합니다.

## Safety boundaries

- AI output이 Terraform, AWS, GitHub write, production 변경을 직접 실행하지 않습니다.
- Terraform apply와 destroy는 명시적 승인이 필요합니다.
- 설정된 모든 필수 인프라 및 애플리케이션 check가 통과해야 recovery success입니다.
- failed, skipped, unverified, cleanup-failed 상태를 report에 유지합니다.
- Production account는 제품 범위에서 제외합니다.

## License

첫 public release 전에 license를 결정합니다.
