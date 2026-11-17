# Phoenix Protocol MVP Tasks

**Canonical Kiro task list:** `.kiro/specs/phoenix-protocol/tasks.md`

## Phase 1: Foundation and contracts

- [x] **Task 1: Scaffold the workspace and safe defaults**
  - Acceptance: `apps/web`, `apps/api`, `packages/*`, `fixtures/*`, `tests/*` exist; package scripts expose typecheck/test/build; `.env` is ignored.
  - Verify: `npm install`; `npm run typecheck`; `npm test`; `npm run build`.
  - Result: completed; typecheck, 7 tests, and Next.js production build pass.
  - Dependencies: None.
  - Files likely touched: `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`, `apps/`, `packages/`, `fixtures/`, `tests/`.
  - Estimated scope: Medium.

- [x] **Task 2: Define shared evidence contracts**
  - Acceptance: schemas/types cover source snapshot, evidence references, findings, blueprint steps, execution lifecycle, verification results, and reports; verified/inferred/assumption/recommendation states are distinct.
  - Verify: `npm test -- contracts`; schema fixtures validate and invalid fixtures fail.
  - Result: 7 contract tests pass, including invalid findings/reports and explicit unverified execution checks.
  - Dependencies: Task 1.
  - Files likely touched: `packages/contracts/*`, `tests/contracts/*`.
  - Estimated scope: Medium.

- [x] **Task 3: Implement the NVIDIA NIM adapter**
  - Acceptance: adapter uses the configured managed endpoint/model; reads the key only server-side; validates structured output; retries only bounded transient failures; redacts credentials.
  - Verify: `npm test -- ai-provider`; `npm run test:nim -- --module ai-provider` with an opt-in live key.
  - Result: 4 mock adapter tests and 1 live managed NIM smoke test passed; live response completed in 45.8 seconds with `z-ai/glm-5.3-flash`.
  - Dependencies: Task 2.
  - Files likely touched: `packages/ai-provider/*`, `tests/ai-provider/*`, `tests/nim/*`, `fixtures/nim/*`.
  - Estimated scope: Medium.

### Checkpoint: Foundation

- [x] Typecheck, unit tests, and build pass.
- [x] No test logs or browser bundles contain `NVIDIA_API_KEY`.

## Phase 2: Deterministic analysis path

- [ ] **Task 4: Add commit-pinned GitHub repository snapshots**
  - Acceptance: public repository, branch, root module, resolved commit SHA, and snapshot identity are returned; invalid roots and URLs fail safely.
  - Verify: `npm test -- repository`; `npm run test:integration -- repository`.
  - Dependencies: Task 2.
  - Files likely touched: `packages/repository/*`, `tests/repository/*`.
  - Estimated scope: Medium.

- [ ] **Task 5: Implement Terraform analysis**
  - Acceptance: at least 10 initial AWS resource types, modules, data sources, variables, outputs, dependencies, unsupported constructs, and source locators are represented.
  - Verify: `npm test -- analyzer`; `npm run test:fixtures -- analyzer`.
  - Dependencies: Tasks 2 and 4.
  - Files likely touched: `packages/analyzer/*`, `fixtures/terraform/*`, `tests/analyzer/*`.
  - Estimated scope: Large; split parser and diagnostics if it exceeds five files.

- [ ] **Task 6: Implement dependency graph generation**
  - Acceptance: stable node IDs, dependent-to-prerequisite directed edges, external/unresolved states, cycle diagnostics, and JSON export exist.
  - Verify: `npm test -- dependency-graph`; graph snapshots match expected fixtures.
  - Dependencies: Task 5.
  - Files likely touched: `packages/analyzer/graph/*`, `tests/graph/*`.
  - Estimated scope: Small.

- [ ] **Task 7: Implement recovery risk analysis**
  - Acceptance: deterministic risk rules run first; NIM suggestions remain inferred/needs-evidence; each finding has severity, source evidence, and recommended action.
  - Verify: `npm test -- recovery-risk`; `npm run test:nim -- --module recovery-risk`.
  - Dependencies: Tasks 3, 5, and 6.
  - Files likely touched: `packages/recovery/risk/*`, `tests/recovery-risk/*`, `fixtures/nim/*`.
  - Estimated scope: Medium.

### Checkpoint: Analysis

- [ ] Demo fixture exposes at least 10 supported resources.
- [ ] Intentional blocker is detected with a source locator.
- [ ] NIM failure leaves deterministic findings available.

## Phase 3: Recovery proof path

- [ ] **Task 8: Generate and approve Recovery Blueprints**
  - Acceptance: dependency-ordered steps include inputs, prerequisites, expected outcomes, verification plan, and approval state; apply steps are blocked before approval.
  - Verify: `npm test -- recovery-blueprint`; invalid order and missing outcome fixtures fail.
  - Dependencies: Tasks 3, 6, and 7.
  - Files likely touched: `packages/recovery/blueprint/*`, `tests/recovery-blueprint/*`.
  - Estimated scope: Medium.

- [ ] **Task 9: Implement the local/mock recovery runner**
  - Acceptance: lifecycle covers approval, run, failure, cleanup, and cleanup failure; logs/resources/results connect to a session; no AWS call is made.
  - Verify: `npm test -- recovery-runner`; `npm run recovery:mock -- --fixture demo-blocker`.
  - Dependencies: Tasks 2 and 8.
  - Files likely touched: `packages/recovery/runner/*`, `fixtures/recovery/*`, `tests/recovery-runner/*`.
  - Estimated scope: Medium.

- [ ] **Task 10: Implement verification checks**
  - Acceptance: infrastructure and application layers are separate; required/optional, passed/failed/skipped/unverified states are preserved; DB check is configurable.
  - Verify: `npm test -- verification`; `npm run verify:mock -- --session <id>`.
  - Dependencies: Task 9.
  - Files likely touched: `packages/recovery/verification/*`, `tests/verification/*`.
  - Estimated scope: Medium.

- [ ] **Task 11: Generate evidence reports**
  - Acceptance: canonical JSON and HTML include commit, graph, risks, blueprint, execution, verification, actual duration, and failure states with evidence references.
  - Verify: `npm test -- evidence-report`; `npm run test:report -- evidence-report`.
  - Dependencies: Tasks 7-10.
  - Files likely touched: `packages/recovery/report/*`, `tests/report/*`.
  - Estimated scope: Medium.

### Checkpoint: Mock recovery

- [ ] Required checks all pass before `RECOVERY VERIFIED`.
- [ ] Apply success plus application failure is not a successful recovery.
- [ ] Failed, skipped, unverified, and cleanup-failed states appear in the report.

## Phase 4: Console and AWS evaluation

- [ ] **Task 12: Connect the REST API and web console**
  - Acceptance: UI calls the API and renders actual repository, graph, findings, blueprint, timeline, checks, and report data; approval boundary is visible.
  - Verify: `npm test -- web-console`; `npm run test:e2e`.
  - Dependencies: Tasks 4, 6-11.
  - Files likely touched: `apps/api/*`, `apps/web/*`, `tests/e2e/*`.
  - Estimated scope: Large; split API and UI if it exceeds five files.

- [ ] **Task 13: Add NIM evaluation reporting**
  - Acceptance: golden/adversarial evaluations report schema, grounding, separation, safety, failure handling, latency, prompt version, and response hash.
  - Verify: `npm run test:nim`; evaluation fails on invalid deterministic contract or unsafe claim.
  - Dependencies: Tasks 3, 7, 8, and 11.
  - Files likely touched: `packages/ai-provider/evaluation/*`, `fixtures/nim/*`, `tests/nim/*`.
  - Estimated scope: Medium.

- [ ] **Task 14: Add gated AWS sandbox adapter**
  - Acceptance: explicit sandbox target, temporary credentials from the authenticated `default` SSO profile, allowlist, TTL, budget/cleanup policy, and preflight are required before real Terraform execution; credential contents are never read into logs or source.
  - Verify: `npm test -- aws-sandbox`; run a real smoke test only after explicit account/role/region approval.
  - Dependencies: Tasks 9-13.
  - Files likely touched: `packages/recovery/aws/*`, `tests/aws-sandbox/*`, `docs/`.
  - Estimated scope: Large; split preflight and execution adapter if needed.

### Final Checkpoint

- [ ] Public GitHub to mock recovery report works end to end.
- [ ] NIM evaluation is reproducible and evidence-grounded.
- [ ] AWS mode is disabled by default and cannot target production.
