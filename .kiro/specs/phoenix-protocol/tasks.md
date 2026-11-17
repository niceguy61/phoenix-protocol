# Phoenix Protocol Tasks

**Requirements:** `.kiro/specs/phoenix-protocol/requirements.md`  
**Design:** `.kiro/specs/phoenix-protocol/design.md`  
**Status:** Implementation in progress  
**Last updated:** 2026-11-17

## Phase 1: Foundation

- [x] **1. Scaffold the workspace and safe defaults**
  - Create the TypeScript workspace, `apps/web`, `apps/api`, shared packages, fixtures, test scripts, and secret-safe `.gitignore`.
  - Acceptance: install, typecheck, test, and build scripts exist; `.env` is ignored.
  - Verify: `npm install`; `npm run typecheck`; `npm test`; `npm run build`.
  - Result: completed; typecheck, 7 tests, and Next.js production build pass.
  - Depends on: none.

- [x] **2. Define shared contracts**
  - Add schemas/types for source snapshots, evidence, graph, findings, blueprints, sessions, checks, and reports.
  - Acceptance: valid fixtures pass and invalid/partial/unavailable fixtures fail or retain explicit state.
  - Verify: `npm test -- contracts`.
  - Result: 7 contract tests pass, including invalid findings/reports and explicit unverified execution checks.
  - Depends on: 1.

- [x] **3. Implement the managed NVIDIA NIM adapter**
  - Add server-only configuration using `NVIDIA_BASE_URL`, `NVIDIA_MODEL`, and `NVIDIA_API_KEY`.
  - Acceptance: timeout/retry, redaction, structured-output validation, typed errors, and response metadata work without exposing the key.
  - Verify: `npm test -- ai-provider`; `npm run test:nim -- --module ai-provider`.
  - Result: 4 mock adapter tests and 1 live managed NIM smoke test passed; live response completed in 45.8 seconds with `z-ai/glm-5.3-flash`.
  - Depends on: 2.

### Checkpoint: Foundation

- [x] Focused tests, typecheck, and build pass.
- [x] No test output or browser bundle contains `NVIDIA_API_KEY`.

## Phase 2: Deterministic analysis

- [x] **4. Implement public GitHub commit-pinned snapshots**
  - Acceptance: branch/ref resolves to a commit SHA; root path is validated; snapshot identity is stored.
  - Verify: `npm test -- repository`; `npm run test:integration -- repository`.
  - Result: 5 repository unit tests and 1 live public GitHub integration test pass. Snapshot resolution validates the URL, root path, commit SHA, stable snapshot ID, and archive URL.
  - Depends on: 2.

- [x] **5. Implement Terraform analysis**
  - Acceptance: initial AWS resource set, modules, data sources, variables, outputs, dependencies, unsupported constructs, and source locators are represented.
  - Verify: `npm test -- analyzer`; `npm run test:fixtures -- analyzer`.
  - Result: 4 analyzer tests pass; 10 supported resources, dependencies, variables, module/data/output metadata, hardcoded-value diagnostics, unsupported resource diagnostics, invalid-HCL diagnostics, and fixtures are implemented.
  - Depends on: 2, 4.

- [x] **6. Implement the dependency graph**
  - Acceptance: stable node IDs, directed edges, external/unresolved states, cycle diagnostics, and JSON export exist.
  - Verify: `npm test -- dependency-graph`.
  - Result: 3 graph tests pass; graph output provides stable sorted nodes, dependent-to-prerequisite edges, unresolved dependencies, and cycle paths.
  - Depends on: 5.

- [ ] **7. Implement recovery risk analysis**
  - Acceptance: deterministic rules work without NIM; NIM output is schema-validated and remains inferred/recommendation/needs-evidence unless grounded.
  - Verify: `npm test -- recovery-risk`; `npm run test:nim -- --module recovery-risk`.
  - Depends on: 3, 5, 6.

### Checkpoint: Analysis

- [ ] Demo fixture exposes at least 10 supported resources.
- [ ] Intentional blocker is found with source evidence.
- [ ] NIM unavailability does not remove deterministic findings.

## Phase 3: Local/mock recovery proof

- [ ] **8. Implement Recovery Blueprint and approval state**
  - Acceptance: steps are dependency ordered, have expected outcomes and inputs, and block apply before approval.
  - Verify: `npm test -- recovery-blueprint`.
  - Depends on: 3, 6, 7.

- [ ] **9. Implement local/mock runner lifecycle**
  - Acceptance: approval, execution, failure, cleanup, and cleanup-failed states are represented with session evidence; no AWS calls occur.
  - Verify: `npm test -- recovery-runner`; `npm run recovery:mock -- --fixture demo-blocker`.
  - Depends on: 2, 8.

- [ ] **10. Implement verification**
  - Acceptance: infrastructure/application layers, required/optional status, passed/failed/skipped/unverified states, and configured DB connectivity work.
  - Verify: `npm test -- verification`; `npm run verify:mock -- --session <id>`.
  - Depends on: 9.

- [ ] **11. Implement evidence reports**
  - Acceptance: canonical JSON and HTML contain actual execution evidence, failures, skipped states, unverified states, and duration comparison.
  - Verify: `npm test -- evidence-report`; `npm run test:report -- evidence-report`.
  - Depends on: 7, 8, 9, 10.

### Checkpoint: Mock recovery

- [ ] Required checks all pass before `RECOVERY VERIFIED`.
- [ ] Apply success plus application failure is not a successful recovery.
- [ ] Cleanup failures remain visible.

## Phase 4: Console and NIM evaluation

- [ ] **12. Connect REST API and web console**
  - Acceptance: UI renders actual API responses for repository, graph, risks, blueprint, approval, timeline, verification, and report.
  - Verify: `npm test -- web-console`; `npm run test:e2e`.
  - Depends on: 4, 6, 7, 8, 9, 10, 11.

- [ ] **13. Add NIM golden/adversarial evaluation reporting**
  - Acceptance: schema, grounding, separation, safety, failure handling, latency, prompt version, and response hash are reported.
  - Verify: `npm run test:nim`.
  - Depends on: 3, 7, 8, 11.

### Final local/mock gate

- [ ] Public GitHub → analysis → graph/risk → blueprint approval → mock recovery → verification → report passes end to end.
- [ ] `npm run typecheck`, `npm test`, `npm run test:nim`, `npm run test:e2e`, and `npm run build` pass.
- [ ] AWS mode remains disabled by default.

## Phase 5: Explicit AWS sandbox extension

- [ ] **14. Add gated AWS sandbox preflight and adapter**
  - Acceptance: explicit sandbox target, temporary credentials from the authenticated `default` SSO profile, allowlists, TTL, budget, cleanup, and preflight are required.
  - Verify: `npm test -- aws-sandbox`; run a real smoke test only after explicit account/role/region approval.
  - Depends on: 9, 10, 11, 12, 13.
  - Safety: do not call real AWS or run Terraform apply/destroy until the sandbox target and approval are recorded.
