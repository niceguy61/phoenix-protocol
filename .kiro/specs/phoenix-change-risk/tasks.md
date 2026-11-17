# Phoenix Change Risk & Evidence Ledger Tasks

**Requirements:** `.kiro/specs/phoenix-change-risk/requirements.md`  
**Design:** `.kiro/specs/phoenix-change-risk/design.md`  
**Status:** Implementation in progress  
**Last updated:** 2026-11-17

## Phase 1: Change snapshots

- [x] **1. Capture base/proposed commits**
  - Acceptance: two immutable GitHub snapshots and changed Terraform files/resources are recorded.
  - Verify: unit tests for same-commit, changed-file, and invalid-ref cases.
  - Result: base/proposed commit capture and added/modified/deleted Terraform file hashes are implemented and tested.
  - Depends on: existing repository module.

- [ ] **2. Define change and ledger contracts**
  - Acceptance: snapshot, change, evidence event, reconciliation, impact, and report schemas validate success/failed/unknown states.
  - Verify: contract tests include invalid and incomplete evidence.
  - Depends on: 1.

## Phase 2: Live reconciliation

- [ ] **3. Complete AWS inventory coverage**
  - Acceptance: inventory exposes service readers, tagged-resource extension, account/region/profile, timestamps, and limitations.
  - Verify: mocked SDK tests plus read-only default-profile smoke test.
  - Depends on: existing inventory reader.

- [ ] **4. Add DSQL, Route 53, ACM, and API Gateway readers**
  - Acceptance: dedicated readers return normalized summaries and do not read secret values or application data.
  - Verify: service fixtures and permission-error tests.
  - Depends on: 3.

- [ ] **5. Implement Terraform-to-live reconciliation**
  - Acceptance: exact/strong/heuristic/unknown match levels and evidence references are emitted; counts are never labeled exact drift.
  - Verify: matching, missing, unmanaged, duplicate-tag, and incomplete-coverage fixtures.
  - Depends on: 2, 3, 4.

## Phase 3: Change impact and report

- [ ] **6. Implement recovery impact engine**
  - Acceptance: changed resources map to affected checks; unbounded impact selects full verification.
  - Verify: IAM, secret, ECS, ALB, DB, DNS, and module-change fixtures.
  - Depends on: 1, 5.

- [ ] **7. Implement Evidence Ledger persistence**
  - Acceptance: append-only events recreate a report without re-querying AWS; corrections create versions.
  - Verify: replay, failure, and duplicate-event tests.
  - Depends on: 2, 5, 6.

- [ ] **8. Implement live NIM change-risk report**
  - Acceptance: sanitized evidence packet, bounded retry, response metadata, schema validation, and unsafe-output handling work end to end.
  - Verify: golden/adversarial fixtures and opt-in live NIM case.
  - Depends on: existing NIM adapter, 5, 6, 7.

## Phase 4: Review and targeted verification

- [ ] **9. Add change-review API and console**
  - Acceptance: before/after commits, reconciliation, impact, NIM report, ledger, and approval are visible in one review flow.
  - Verify: Playwright change-review flow.
  - Depends on: 1-8.

- [ ] **10. Add targeted sandbox verification**
  - Acceptance: only affected checks run when impact is bounded; full recovery is selected otherwise; AWS mutation remains gated.
  - Verify: mock targeted/full flows and operator-approved AWS preflight.
  - Depends on: 6, 7, 9.

## Definition of done

- [ ] A Terraform change produces a before/after evidence ledger.
- [ ] Live AWS inventory is reconciled with honest coverage labels.
- [ ] NIM explains the decision without inventing evidence.
- [ ] A DevOps/SRE reviewer can decide whether the change is safe to ship.
- [ ] No production mutation is possible from the default path.
