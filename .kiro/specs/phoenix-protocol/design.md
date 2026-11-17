# Phoenix Protocol Design

**Requirements:** `.kiro/specs/phoenix-protocol/requirements.md`  
**Status:** Approved for implementation  
**Last updated:** 2026-11-17

## 1. Architecture

Phoenix Protocol is a single repository with a Next.js web console, a Node.js REST API, and shared TypeScript packages. It is modular without introducing distributed services before the recovery workflow needs them.

```text
Next.js web console
        │ REST / JSON
        ▼
Node.js API / orchestrator
        │
        ├── repository snapshot
        ├── Terraform analyzer ── dependency graph
        ├── deterministic risk rules ── NIM adapter
        ├── Recovery Blueprint / approval
        ├── mock runner or gated AWS runner
        ├── verification engine
        └── evidence report
                │
                ▼
        PostgreSQL persistence (session/evidence metadata)
```

## 2. Project Structure

```text
apps/web/                 Next.js console and accessible workflow UI
apps/api/                 REST API, orchestration, server-side NIM calls
packages/contracts/       JSON schemas and shared TypeScript types
packages/ai-provider/     NVIDIA NIM adapter, redaction, evaluation
packages/repository/      GitHub metadata and commit-pinned snapshots
packages/analyzer/        Terraform parsing, inventory, graph, diagnostics
packages/recovery/        blueprint, runner, verification, reports
fixtures/terraform/       valid, blocker, unsupported Terraform inputs
fixtures/nim/             golden and adversarial NIM cases
fixtures/recovery/       mock execution traces
fixtures/reports/         canonical report fixtures
tests/integration/        API and package contract tests
tests/e2e/                Playwright end-to-end tests
.kiro/specs/              canonical Kiro requirements/design/tasks
.kiro/steering/           project-wide Kiro rules
.kiro/agents/             project agent definition
tasks/                    compatibility plan and task-runner specs
docs/                     PRD and module-level reference specs
```

## 3. Module Boundaries

### `contracts`

Owns JSON schemas and TypeScript types for `SourceSnapshot`, `EvidenceRef`, `Finding`, `Graph`, `Blueprint`, `ExecutionSession`, `VerificationCheck`, and `EvidenceReport`. Other packages import contracts instead of defining duplicate shapes.

### `ai-provider`

Owns the OpenAI-compatible NIM HTTP adapter, request construction, timeout/retry, redaction, schema validation, prompt versioning, and evaluation metadata. It does not decide whether infrastructure recovered.

### `repository`

Owns public GitHub access, branch-to-commit resolution, root path validation, and source snapshot identity. It does not parse Terraform.

### `analyzer`

Owns deterministic HCL/Terraform analysis and graph construction. It does not call NIM and does not infer unsupported facts.

### `recovery`

Owns risk orchestration, blueprint generation, mock/AWS runner interfaces, verification, and report generation. The AWS adapter is disabled unless sandbox preflight passes.

### `web`

Owns presentation and user approval interactions. It calls API contracts only and never receives NIM/AWS credentials.

## 4. Evidence Model

All significant results carry an evidence classification:

```text
verified       deterministic source or execution evidence directly proves it
inferred       model or rule derives it from available evidence
assumption     input is missing and a working assumption is stated
recommendation proposed action, never a fact
needs-evidence evidence is insufficient for a safe conclusion
```

`EvidenceRef` should include:

- `sourceType`: repository, terraform, execution-log, aws-observation, verification, model
- `locator`: file/line, resource ID, log event, or check ID
- `sessionId`
- `observedAt`
- optional `contentHash`

## 5. NIM Adapter Design

Configuration is read only in `apps/api`:

```text
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=z-ai/glm-5.3-flash
NVIDIA_API_KEY=<server environment only>
```

The adapter calls the managed endpoint using the OpenAI-compatible chat completion surface. It must:

- use a bounded timeout;
- retry rate-limit and transient 5xx responses only;
- reject malformed JSON and invalid schemas;
- redact secrets before logs and traces;
- record model, prompt version, request ID, latency, and response hash;
- return typed `AiUnavailable`, `AiInvalidResponse`, and `AiPolicyViolation` errors;
- return suggestions that remain `inferred`, `recommendation`, or `needs-evidence`.

The NIM adapter receives a minimal evidence packet. It never receives AWS credentials, GitHub tokens, or raw secret values.

## 6. Recovery State Machine

```text
created
  → awaiting-approval
  → approved
  → running
  → verifying
  → completed | failed
  → cleanup-pending
  → cleaned | cleanup-failed
```

`RECOVERY VERIFIED` is a derived report status, not a runner state. It requires every configured required verification check to be `passed`.

## 7. Runner Interface

The mock and AWS runners implement the same interface:

```ts
interface RecoveryRunner {
  preflight(session: RecoverySession): Promise<PreflightResult>;
  execute(session: ApprovedRecoverySession): Promise<ExecutionResult>;
  cleanup(session: RecoverySession): Promise<CleanupResult>;
}
```

The mock runner uses deterministic fixtures and never invokes AWS. The AWS runner requires:

- explicit sandbox account/role/region allowlist;
- authenticated `default` SSO profile or equivalent temporary credentials;
- TTL and budget guard;
- resource naming/prefix policy;
- idempotent cleanup;
- explicit user approval.

No AWS runner implementation is enabled by default.

## 8. API Surface

Initial REST resources:

- `POST /api/snapshots`
- `POST /api/analyses`
- `GET /api/analyses/:id`
- `GET /api/analyses/:id/graph`
- `GET /api/analyses/:id/risks`
- `POST /api/recovery-sessions`
- `POST /api/recovery-sessions/:id/approve`
- `POST /api/recovery-sessions/:id/run`
- `GET /api/recovery-sessions/:id`
- `GET /api/recovery-sessions/:id/verification`
- `GET /api/recovery-sessions/:id/report`

`POST .../run` rejects requests unless the session has an approval record and the selected mode is allowed by configuration.

## 9. Test Design

### Deterministic tests

- Terraform parser and graph fixtures
- repository URL/ref/root validation
- contract/schema validation
- runner lifecycle and cleanup outcomes
- verification status derivation
- report JSON/HTML equivalence

### NIM evaluation

- golden cases for correctly grounded risks and blueprints
- adversarial cases for unsupported claims, credential requests, production apply suggestions, and missing evidence
- metadata assertions for model, prompt version, latency, and response hash

### End-to-end

Playwright runs the mock path from repository selection to report. It asserts API responses are rendered and approval is required before runner execution.

## 10. Security Controls

- `.env` is ignored by version control.
- API key access is server-only.
- Logs use centralized redaction.
- AWS mode is feature/configuration gated and deny-by-default.
- Production account/role/region is rejected.
- No AI response is executable code or authorization.
- Reports preserve failures instead of normalizing them into success.
