# Phoenix Protocol

[![한국어 README](https://img.shields.io/badge/README-한국어-3b82f6)](README.ko.md)
[![Built with Kiro](https://img.shields.io/badge/Built%20with-Kiro-6c47ff)](https://kiro.dev/)
[![Kiro Crew workflow](https://img.shields.io/badge/Workflow-Kiro%20Crew-111827)](https://kiro.dev/)
[![Status: Prototype](https://img.shields.io/badge/Status-Prototype-f59e0b)](#status)

> Prove your infrastructure can rise again.

Phoenix Protocol is an evidence-first infrastructure recovery verification platform. It analyzes Terraform, discovers recovery dependencies, generates a Recovery Blueprint, runs a rebuild in an isolated environment, verifies infrastructure and application health, and produces an evidence report.

Static analysis can identify risk. Only an executed recovery and successful required health checks can prove recovery.

## Status

This repository is an active prototype. The initial foundation is implemented and the first managed NVIDIA NIM smoke test passes. The next implementation slice adds public GitHub commit-pinned snapshots and deterministic Terraform analysis.

The current execution path is local/mock. AWS sandbox execution is intentionally gated until its account, role, region, cost, TTL, and cleanup boundaries are configured and approved.

## MVP workflow

```text
Public GitHub repository
  → Commit-pinned Terraform snapshot
  → Deterministic analysis
  → Dependency graph and recovery risks
  → Recovery Blueprint
  → Explicit approval
  → Local/mock recovery execution
  → Infrastructure and application verification
  → JSON/HTML evidence report
```

## NVIDIA NIM evaluation

AI reasoning is isolated behind a server-side provider adapter. The current evaluation target is:

- Base URL: `https://integrate.api.nvidia.com/v1`
- Model: `z-ai/glm-5.3-flash`
- Evaluation: schema validity, evidence grounding, uncertainty separation, safety, and failure handling

The API key must remain in a local environment file or secret provider. Never commit `.env`, print `NVIDIA_API_KEY`, or expose it to browser code.

## Development

Requirements:

- Node.js 22 or newer
- npm
- Terraform CLI for the recovery-analysis stages
- A managed NVIDIA NIM API key for the opt-in live smoke test

Install dependencies and run the deterministic checks:

```bash
npm install
npm run typecheck
npm test
npm run build
```

Run the opt-in live NIM smoke test without printing the key:

```bash
node --env-file=.env node_modules/vitest/vitest.mjs run tests/nim/live.test.ts
```

The live smoke test is opt-in. The normal test suite uses mock NIM responses and does not require an API key.

## Project structure

```text
.kiro/specs/phoenix-protocol/   Kiro-native requirements, design, and tasks
.kiro/steering/                  Project rules loaded by Kiro
.kiro/agents/                    Project agent definition
docs/                            PRD and module reference specs
apps/web/                        Next.js console
apps/api/                        Server-side API boundary
packages/contracts/              Shared evidence and lifecycle schemas
packages/ai-provider/            NVIDIA NIM adapter and evaluation
fixtures/                        Terraform, NIM, recovery, and report fixtures
tests/                            Integration, E2E, and live evaluation tests
tasks/                            Compatibility plan and Task Runner specs
```

## Kiro development workflow

This project is developed with **Kiro** and **Kiro Crew**.

- Requirements, architecture, and implementation tasks live in the Kiro-native spec at `.kiro/specs/phoenix-protocol/`.
- Steering files enforce evidence-first testing and security boundaries.
- Kiro Crew Task Runner is used for structured implementation slices.
- Figma MCP is used when the console UI moves from scaffold to product design.

## Safety boundaries

- AI output never directly invokes Terraform, AWS, GitHub writes, or production changes.
- Terraform apply and destroy require explicit approval.
- Recovery success requires every configured required infrastructure and application check to pass.
- Failed, skipped, unverified, and cleanup-failed states remain visible in reports.
- Production accounts are outside the product scope.

## License

License to be selected before the first public release.
