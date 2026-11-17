# Phoenix Change Risk & Evidence Ledger Design

**Requirements:** `.kiro/specs/phoenix-change-risk/requirements.md`  
**Status:** Approved for implementation  
**Last updated:** 2026-11-17

## 1. Product Boundary

```text
GitHub base/proposed commits
          │
          ▼
Terraform before/after analysis ─────┐
          │                          │
          ▼                          │
Changed resource set                 │
                                     ▼
AWS read-only inventory ───────► Reconciliation
                                     │
                                     ▼
                          Recovery impact analysis
                                     │
                                     ▼
                          Targeted verification plan
                                     │
                                     ▼
                    Approval → sandbox execution → checks
                                     │
                                     ▼
                         Evidence Ledger + NIM report
```

The API owns orchestration and credential boundaries. The browser owns review and approval interactions. The NIM adapter owns model transport and schema validation. The Evidence Ledger owns the durable decision record.

## 2. Modules

### `change-capture`

Resolves base/proposed GitHub commits and computes changed files/resources. It never uses a mutable branch as evidence identity.

### `aws-inventory`

Uses AWS SDK v3 named-profile clients on the server. It exposes read-only resource summaries with account, region, timestamp, and coverage metadata.

### `reconciliation`

Compares Terraform resource metadata and live AWS inventory. It emits exact/strong/heuristic/unknown match levels and evidence references.

### `impact-engine`

Maps changed resources and risk findings to affected recovery checks. It can choose targeted checks or require a full recovery run.

### `evidence-ledger`

Stores immutable snapshots, observations, decisions, and report inputs. The ledger is append-only and each correction creates a new version.

### `nim-report`

Sends only sanitized evidence packets to NVIDIA NIM. The output is a report explanation, never authorization or source evidence.

### `targeted-runner`

Reuses the existing mock/AWS runner interfaces. It accepts an explicit check set and approval token.

### `web-console`

Renders change review, reconciliation, evidence references, NIM evaluation, targeted checks, and final report.

## 3. Inventory Data Model

```ts
interface InventorySnapshot {
  snapshotId: string;
  accountId: string;
  profile: string;
  region: string;
  collectedAt: string;
  resources: AwsResourceSummary[];
  coverage: {
    serviceReaders: string[];
    taggedResourceCount: number;
    limitations: string[];
  };
}

interface AwsResourceSummary {
  id: string;
  kind: string;
  status: string;
  name?: string;
  metadata?: Record<string, string>;
}
```

Resource values are summaries only. The inventory layer does not read secret values, database rows, object bodies, or application payloads.

## 4. Reconciliation Rules

- Never compare an AWS ARN to a Terraform address as if they were the same identifier.
- Prefer Terraform state/provider IDs when available.
- Use resource kind counts only as `heuristic` evidence.
- Exclude `tagged-resource` duplicates from exact service counts.
- If a resource kind has no dedicated reader, report coverage limitation.
- A missing inventory item is `unknown` when the service reader is incomplete, not `missing-in-aws`.

## 5. Change Impact Rules

Initial mapping:

| Changed area | Affected checks |
|---|---|
| `aws_iam_role`, `aws_iam_policy` | permissions, resource existence |
| `aws_secretsmanager_secret`, `aws_kms_key` | secret/encryption readiness |
| `aws_ecs_service`, image attributes | ECS stability, HTTP health |
| `aws_lb`, `aws_lb_target_group` | ALB target health, HTTP health |
| `aws_db_instance` | database connectivity |
| `aws_route53_*`, certificate references | DNS/certificate readiness |
| variable/module/dependency changes | full dependency verification |

If no bounded impact can be established, the engine selects a full recovery verification plan.

## 6. Evidence Ledger Lifecycle

```text
draft
  → snapshots-captured
  → reconciled
  → impact-assessed
  → awaiting-approval
  → verifying
  → finalized | failed | needs-evidence
```

Each transition appends an event. No event mutates an earlier event. A final report references event IDs and source hashes.

## 7. NIM Report Contract

NIM receives a compact JSON packet:

```json
{
  "change": { "baseCommit": "...", "proposedCommit": "...", "changedResources": [] },
  "reconciliation": [],
  "affectedChecks": [],
  "evidenceRefs": [],
  "constraints": ["Do not invent evidence", "Do not authorize mutations"]
}
```

NIM returns:

- executive summary;
- risk explanations;
- evidence references;
- assumptions;
- recommendations;
- needs-evidence list.

The adapter uses bounded retries for timeout/network/429/5xx. It rejects invalid JSON and unsafe recommendations. It records model, prompt version, latency, and response hash.

## 8. API Surface

- `GET /api/aws/inventory?profile=default&region=ap-northeast-2`
- `POST /api/change-analyses`
- `GET /api/change-analyses/:id`
- `GET /api/change-analyses/:id/reconciliation`
- `GET /api/change-analyses/:id/impact`
- `POST /api/change-analyses/:id/approve`
- `POST /api/change-analyses/:id/verify`
- `GET /api/change-analyses/:id/ledger`
- `GET /api/change-analyses/:id/report`

## 9. Security Boundary

- AWS credentials stay in the API process.
- Browser sends profile name, never credentials.
- Inventory calls are read-only by default.
- Apply/destroy require sandbox allowlist and approval.
- NIM never receives secret values or raw database/object contents.
- Production account targets are denied by default.
