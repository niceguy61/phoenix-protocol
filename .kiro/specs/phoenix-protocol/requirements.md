# Phoenix Protocol Requirements

**Status:** Approved for implementation planning  
**Source:** `D:\phoenix_protocol\docs\prd.md`  
**Canonical spec:** `.kiro/specs/phoenix-protocol/`  
**Last updated:** 2026-11-17

## 1. Objective

Phoenix Protocol proves whether an AWS infrastructure project can be rebuilt from Terraform and whether the recovered application becomes operational. The product must produce execution evidence, not only static analysis or AI recommendations.

The first complete vertical slice is:

```text
public GitHub repository
  → commit-pinned Terraform snapshot
  → deterministic analysis
  → dependency graph and recovery risks
  → Recovery Blueprint
  → explicit approval
  → local/mock recovery execution
  → infrastructure/application verification
  → JSON/HTML evidence report
```

The final proof adds an explicitly gated AWS sandbox execution after the local/mock path passes.

## 2. Users and User Stories

### DevOps Engineer

- As a DevOps engineer, I want to select a GitHub repository, branch, and Terraform root so that Phoenix analyzes the exact source I intend to recover.
- As a DevOps engineer, I want resource dependencies and recovery blockers shown with file/resource evidence so that I can fix the infrastructure before a disaster.
- As a DevOps engineer, I want to review and approve a recovery plan before provisioning starts so that Phoenix cannot unexpectedly change infrastructure.
- As a DevOps engineer, I want a report containing actual execution and health-check evidence so that recovery readiness is demonstrable.

### SRE / Platform Engineer

- As an SRE, I want infrastructure and application checks separated so that Terraform apply success cannot hide an application recovery failure.
- As an SRE, I want failed, skipped, unverified, and cleanup-failed states preserved so that the report remains operationally trustworthy.
- As an SRE, I want AI suggestions tied to deterministic evidence so that model output does not become an unverified recovery claim.

## 3. Functional Requirements

### REQ-001: Repository Snapshot

The system shall accept a public GitHub repository, branch/ref, and Terraform root module path.

Acceptance criteria:

- The selected ref resolves to an immutable 40-character commit SHA.
- The analysis session stores the repository, ref, commit SHA, root path, and snapshot identity.
- Root paths outside the repository and invalid repository URLs are rejected.
- Repository access credentials, when introduced later, never appear in logs or browser responses.

### REQ-002: Terraform Analysis

The system shall deterministically analyze Terraform source and produce structured metadata for the initial AWS resource set:

`aws_vpc`, `aws_subnet`, `aws_security_group`, `aws_instance`, `aws_lb`, `aws_lb_target_group`, `aws_ecs_cluster`, `aws_ecs_service`, `aws_iam_role`, `aws_iam_policy`, `aws_db_instance`, `aws_s3_bucket`, `aws_kms_key`, and `aws_secretsmanager_secret`.

Acceptance criteria:

- Resource inventory includes stable IDs and source file/line locators.
- Module, data source, variable, output, implicit reference, and explicit `depends_on` relationships are represented.
- Hardcoded values and external prerequisite candidates are reported.
- Unsupported resources and constructs are reported explicitly and are never silently treated as supported.
- The same commit snapshot produces the same deterministic analysis result.

### REQ-003: Dependency Graph

The system shall expose a directed dependency graph as JSON.

Acceptance criteria:

- Nodes represent resources, modules, and data sources.
- Edges point from a dependent to its prerequisite.
- External and unresolved dependencies have explicit states.
- Cycles are diagnosed rather than hidden.
- Node metadata includes the source evidence required by the console and report.

### REQ-004: Recovery Risk Analysis

The system shall identify recovery blockers in these categories: IAM permissions, secrets/encryption, container images, DNS/certificates, manually managed infrastructure, missing variables, unresolved dependencies, and external services.

Acceptance criteria:

- Every finding has an ID, category, severity, status, evidence reference, summary, and recommended action.
- Severity is one of `critical`, `high`, `medium`, or `low`.
- Deterministic findings are produced even when NIM is unavailable.
- NIM-generated inference and recommendations cannot be labeled as verified facts without deterministic evidence.
- Findings with insufficient evidence use `needs-evidence` or `unverified` rather than success.

### REQ-005: NVIDIA NIM Provider

The system shall call managed NVIDIA NIM only through the server-side `ai-provider` adapter.

Configuration:

- `NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1`
- `NVIDIA_MODEL=z-ai/glm-5.3-flash`
- `NVIDIA_API_KEY` is read only by the API server environment/secret boundary.

Acceptance criteria:

- Browser code never receives the API key or calls NIM directly.
- Timeout, bounded retry, malformed JSON, schema failure, rate-limit, and 5xx behavior are tested.
- NIM responses use versioned JSON schemas.
- Prompt version, model, latency, request ID, and response hash are recorded without secrets.
- NIM output is classified as fact, inference, assumption, recommendation, or needs-evidence.

### REQ-006: Recovery Blueprint

The system shall generate an ordered recovery plan from graph, analysis, and risk evidence.

Acceptance criteria:

- Each step has an ID, kind, prerequisites, required inputs, expected outcome, and approval state.
- Dependency order is valid and cycles are rejected.
- Required variables, permissions, and external dependencies are listed.
- Apply/provision steps cannot execute before explicit user approval.
- Estimated duration is kept separate from actual execution duration.

### REQ-007: Recovery Runner

The system shall support a local/mock execution mode first and an explicitly gated AWS sandbox mode later.

Acceptance criteria:

- Session state includes approval, running, verifying, completed/failed, and cleanup states.
- Mock execution simulates success, plan/apply failure, partial execution, and cleanup failure.
- AWS mode requires an allowlisted sandbox target, temporary least-privilege credentials, TTL, budget/cost guard, and cleanup policy.
- AWS SDK/CLI may use the authenticated `default` SSO profile; credential file contents must never be read into application data or logs.
- Production targets are rejected by default.

### REQ-008: Recovery Verification

The system shall separately verify infrastructure recovery and application recovery.

Initial checks:

- Terraform apply completion
- required AWS resource existence
- ECS service stability
- ALB target health
- application HTTP health endpoint
- configured database connectivity

Acceptance criteria:

- Each check records required status, layer, start/end timestamps, result, message, and evidence.
- Results are `passed`, `failed`, `skipped`, or `unverified`.
- Database connectivity is required when configured and explicitly skipped with a reason when not configured.
- `RECOVERY VERIFIED` is possible only when every configured required check passes.
- Terraform apply success alone never produces `RECOVERY VERIFIED`.

### REQ-009: Evidence Report

The system shall produce canonical JSON and HTML reports for every completed recovery session.

Acceptance criteria:

- The report includes repository/commit, inventory, graph, risks, blueprint, approval, execution history, verification, failed checks, actual duration, and estimate comparison.
- Every headline result references actual evidence or explicitly states why evidence is unavailable.
- Failed, skipped, unverified, and cleanup-failed states remain visible.
- HTML renders the canonical JSON without changing status or counts.

### REQ-010: Web Console

The console shall provide a guided flow from repository selection through evidence report.

Acceptance criteria:

- The UI renders real API responses rather than local fake success states.
- Graph, risk, blueprint, approval, execution timeline, verification, and report are visible.
- AI suggestions and verified facts are visually separate.
- Korean UI uses Noto Sans KR as the primary font.
- Approval boundaries and unavailable data are clear and accessible.

## 4. Non-Functional Requirements

### Security

- Never expose `.env`, `NVIDIA_API_KEY`, AWS credentials, GitHub tokens, or private keys.
- Never execute AI-generated commands directly.
- Never use production credentials for recovery.
- Redact credential-like values in logs and reports.

### Reliability

- Preserve partial execution and cleanup failures.
- Make cleanup idempotent.
- Keep recovery sessions traceable to a commit SHA.
- Make NIM failure explicit without disabling deterministic analysis.

### Performance Targets

- Static analysis under 60 seconds for the controlled demo.
- Graph rendering under 3 seconds.
- Report generation under 15 seconds after verification.

### Scope Exclusions

- Production disaster recovery orchestration
- Automatic production failover
- Full AWS resource coverage
- Kubernetes recovery
- Multi-cloud support
- Autonomous production remediation
- Private GitHub integration in the first vertical slice

## 5. Definition of Done

A requirement is complete only when:

- deterministic tests cover its success and failure states;
- AI-affecting behavior has a golden or adversarial NIM fixture;
- focused verification and the relevant typecheck/build/E2E command pass;
- evidence references, timestamps, session IDs, or explicit unavailable reasons exist;
- no secret is exposed;
- the corresponding task in `.kiro/specs/phoenix-protocol/tasks.md` is checked only after verification.
