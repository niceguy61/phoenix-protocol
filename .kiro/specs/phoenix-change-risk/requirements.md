# Phoenix Change Risk & Evidence Ledger Requirements

**Status:** Approved for implementation  
**Builds on:** `.kiro/specs/phoenix-protocol/`  
**Target user:** DevOps and SRE teams  
**Last updated:** 2026-11-17

## 1. Product Direction

Phoenix Protocol의 다음 단계는 범용 resilience platform이 아니다. Terraform 변경이 실제 복구 가능성을 어떻게 바꾸는지 판정하고, 그 판정의 근거를 재현 가능한 Evidence Ledger로 남기는 **Recovery Change Risk Gate**다.

> Before a Terraform change ships, prove which recovery guarantees it preserves or breaks.

기존 MVP는 source analysis → graph → risk → blueprint → mock recovery → verification → report 흐름을 제공한다. 이 spec은 그 흐름을 **변경 전후 비교와 실제 AWS inventory reconciliation** 중심으로 확장한다.

## 2. Target User and Core Outcome

### Primary user

DevOps/SRE engineer who:

- deploys AWS infrastructure with Terraform;
- reviews pull requests and Terraform plans;
- must know whether a change weakens disaster recovery readiness;
- needs evidence for incident review, audit, and release approval.

### Core outcome

For a change from commit A to commit B, Phoenix shall answer:

- What infrastructure changed?
- What live AWS resources exist now?
- Which declared resources are missing, unmanaged, or uncertain?
- Which recovery checks are affected?
- What evidence supports the risk decision?
- Can the decision be replayed later?

## 3. Functional Requirements

### CR-001: Before/After Change Capture

The system shall capture two immutable analysis inputs: a base commit and a proposed commit.

Acceptance criteria:

- Each snapshot stores repository, ref, commit SHA, Terraform root, and content hash.
- The system produces a changed-file and changed-resource set.
- A branch name alone is never used as the immutable identity.
- A change can be analyzed without applying Terraform.

### CR-002: Read-only AWS Inventory

The system shall collect a read-only inventory for a selected server-side AWS profile and region.

Initial services:

- VPC and EC2
- ECS
- Application/Network Load Balancers
- RDS
- S3
- DynamoDB
- Lambda
- tagged resources from Resource Groups Tagging API
- follow-up readers for DSQL, Route 53, ACM, and API Gateway

Acceptance criteria:

- Browser receives resource summaries, never AWS credentials.
- Every snapshot records account ID, profile name, region, collection time, and API source.
- Existing resources are never modified, imported, or deleted by inventory collection.
- Coverage limitations are explicit. Tagged-resource coverage is not presented as complete service coverage.

### CR-003: Terraform-to-Live Reconciliation

The system shall compare Terraform analysis with AWS inventory.

Matching levels:

1. **Exact:** Terraform state/provider identifier matches an AWS resource identifier.
2. **Strong:** stable provider address and normalized resource metadata match.
3. **Heuristic:** resource-kind counts or names suggest a relationship.
4. **Unknown:** evidence is insufficient.

Acceptance criteria:

- Results use `matched`, `missing-in-aws`, `unmanaged-candidate`, `no-iac-evidence`, or `unknown`.
- Count comparisons are explicitly labeled heuristic and never called exact drift.
- Existing AWS resources remain read-only evidence.
- The reconciliation output lists the evidence used for every row.

### CR-004: Recovery Impact Analysis

The system shall determine which recovery capabilities are affected by a change.

Acceptance criteria:

- Changed resources map to affected recovery checks.
- A changed secret, IAM role, image, database, load balancer, DNS, or encryption dependency can invalidate a check.
- Unresolved dependency and missing live resource findings are linked to the changed resource when evidence allows.
- A change with insufficient evidence is `needs-evidence`, not success.

### CR-005: Recovery Evidence Ledger

The system shall persist an append-only ledger for each change decision.

Each ledger entry shall include:

- base/proposed commit SHA;
- Terraform analysis hash;
- AWS account/profile/region and inventory timestamp;
- Terraform plan result and hash;
- changed resources;
- reconciliation rows;
- risk findings;
- blueprint and verification results;
- actual execution timestamps and duration;
- NIM model, prompt version, latency, response hash, and evaluation status;
- final decision and evidence references.

Acceptance criteria:

- A report can be regenerated from the ledger without re-querying AWS.
- Facts, inferences, assumptions, recommendations, and missing evidence remain separate.
- Failed, skipped, unverified, and cleanup-failed states remain visible.
- Ledger entries are immutable after finalization; corrections create a new entry.

### CR-006: NIM Change-Risk Report

NVIDIA NIM shall explain evidence; it shall not create evidence or authorize changes.

NIM input shall contain sanitized analysis, inventory summaries, reconciliation rows, and verification results. It shall never contain API keys, secret values, database contents, or raw credential material.

Acceptance criteria:

- Structured output passes a versioned schema.
- Verified facts are grounded in supplied evidence references.
- Risk, recommendation, assumption, and needs-evidence fields are separate.
- Unsafe production mutation suggestions are blocked and reported as expected policy blocks.
- Transient NIM failures retry with bounded backoff; unsafe/schema failures do not retry until they pass.

### CR-007: Change Review Console

The console shall show the change decision as a before/after evidence review.

Required views:

- base vs proposed commit summary;
- changed resources;
- live inventory snapshot and coverage limits;
- reconciliation table;
- affected recovery checks;
- NIM explanation with evaluation state;
- Evidence Ledger timeline;
- targeted verification and final decision.

Acceptance criteria:

- The primary action is a change-risk decision, not generic resource browsing.
- Users can inspect the evidence behind each finding.
- Unavailable data is explicit and never rendered as zero.
- AWS profile selection changes only server-side inventory scope.

### CR-008: Targeted Recovery Verification

The system shall run only the recovery checks affected by a proposed change when targeted execution is sufficient.

Acceptance criteria:

- Targeted checks are derived from changed resources and risk categories.
- Full recovery remains available when impact cannot be bounded.
- Execution requires explicit approval.
- Production targets remain outside the execution boundary.

## 4. Non-Goals

- Becoming a generic continuous resilience map.
- Running every possible scenario on every change.
- Automatically modifying production infrastructure.
- Generating Terraform Pull Requests as the primary product output.
- Replacing Terraform state or AWS-native monitoring.
- Claiming exact drift from resource counts alone.

## 5. Definition of Done

- [ ] Base/proposed commit diff works on a public Terraform repository.
- [ ] Read-only AWS inventory is collected through the selected server-side profile.
- [ ] Terraform-to-live reconciliation labels heuristic matches honestly.
- [ ] At least one changed resource maps to an affected recovery check.
- [ ] Evidence Ledger can regenerate the final report.
- [ ] NIM produces a grounded change-risk explanation or an explicit unavailable result.
- [ ] UI E2E covers change review through final decision.
- [ ] No AWS mutation occurs without explicit sandbox approval.

## 6. Open Questions

1. Should the first change source be GitHub pull requests, two manually selected commits, or Terraform plan files?
2. Which recovery checks are mandatory for the first demo scenario?
3. Should the ledger use PostgreSQL immediately or a file-backed prototype for the first vertical slice?
4. Which services require dedicated readers first: DSQL, Route 53, ACM, or API Gateway?
