# PHOENIX PROTOCOL
## Product Requirements Document (PRD)

**Version:** 1.0  
**Status:** Proposed  
**Project:** Kiroween 2026  
**Category:** Frankenstein  
**Tagline:** Prove Your Infrastructure Can Rise Again.

---

# 1. Product Overview

## 1.1 Product Vision

Phoenix Protocol is an AI-powered infrastructure recovery verification platform.

It analyzes Infrastructure as Code (IaC), discovers hidden dependencies, generates recovery plans, and executes infrastructure rebuild tests in an isolated environment.

Its primary objective is to prove whether infrastructure can actually be recovered from scratch.

**Core Philosophy: Infrastructure Recovery should be demonstrated, not assumed.**

## 1.2 Problem Statement

Organizations increasingly rely on Infrastructure as Code to manage cloud infrastructure.

However, having Terraform code does not guarantee that the infrastructure can be rebuilt successfully.

Common problems include:

- Manually created resources missing from IaC.
- Missing IAM permissions.
- Unavailable container images.
- Missing secrets and encryption dependencies.
- Incorrect resource creation order.
- Hardcoded environment dependencies.
- Missing application-level health checks.
- Recovery procedures that have never been tested.

These issues are often discovered during an actual disaster.

Phoenix Protocol moves recovery verification from disaster response to proactive infrastructure testing.

## 1.3 Product Goals

1. Analyze Terraform projects automatically.
2. Discover infrastructure dependencies.
3. Identify potential recovery blockers.
4. Generate executable recovery plans.
5. Rebuild infrastructure in an isolated environment.
6. Verify application recovery.
7. Generate evidence-based recovery reports.
8. Provide AI-assisted remediation suggestions.

## 1.4 Target Users

**Primary Persona: DevOps Engineer**

- Manages AWS infrastructure using Terraform.
- Maintains CI/CD pipelines.
- Responsible for infrastructure reliability.
- Needs to validate disaster recovery readiness.

**Secondary Persona: SRE / Platform Engineer**

- Manages production infrastructure.
- Defines RTO and RPO objectives.
- Conducts disaster recovery exercises.
- Needs repeatable recovery evidence.

---

# 2. Core User Journey

1. User connects a GitHub repository.
2. User selects a Terraform project directory.
3. Phoenix analyzes Terraform configuration.
4. Phoenix generates an infrastructure dependency graph.
5. AI identifies missing dependencies and recovery risks.
6. AI generates a Recovery Blueprint.
7. User reviews and approves the recovery plan.
8. Recovery Runner provisions an isolated environment.
9. Terraform rebuild is executed.
10. Application health checks are performed.
11. Phoenix generates a Recovery Evidence Report.
12. AI proposes remediation for failed checks.

---

# 3. Functional Requirements

## FR-001: Repository Integration

**Description:** Connect a GitHub repository for infrastructure analysis.

Requirements:

- Support public GitHub repositories.
- Support private repositories through GitHub OAuth or a scoped GitHub App.
- Allow branch selection.
- Allow Terraform directory selection.
- Retrieve repository metadata and source files.
- Preserve the analyzed commit SHA for reproducibility.

Acceptance Criteria:

- User can select a repository and branch.
- User can select a Terraform root module.
- Analysis is associated with an immutable commit SHA.
- Repository access tokens are never exposed in application logs.

## FR-002: Terraform Analyzer

**Description:** Analyze Terraform configurations and generate structured infrastructure metadata.

Initial supported resource types:

- aws_vpc
- aws_subnet
- aws_security_group
- aws_instance
- aws_lb
- aws_lb_target_group
- aws_ecs_cluster
- aws_ecs_service
- aws_iam_role
- aws_iam_policy
- aws_db_instance
- aws_s3_bucket
- aws_kms_key
- aws_secretsmanager_secret

Requirements:

- Parse Terraform configuration.
- Extract resource relationships.
- Extract module dependencies.
- Identify external data sources.
- Identify variable and output dependencies.
- Detect hardcoded values and external prerequisites.
- Identify unsupported Terraform constructs.

Acceptance Criteria:

- Valid Terraform projects can be analyzed.
- Resource relationships are represented in structured JSON.
- Unsupported resources are explicitly reported.
- Analysis failures include actionable error messages.

## FR-003: Dependency Graph

**Description:** Visualize infrastructure relationships.

Requirements:

- Display Terraform resources as graph nodes.
- Display dependencies as directed edges.
- Group resources by service category.
- Highlight external dependencies.
- Highlight missing or unresolved dependencies.
- Support node inspection.

Acceptance Criteria:

- Graph reflects the analyzed Terraform configuration.
- Selecting a node displays resource metadata.
- Unresolved dependencies are visually distinguishable.
- Graph data can be exported as JSON.

## FR-004: Recovery Risk Analysis

**Description:** Identify conditions that may prevent infrastructure recovery.

Risk categories:

- IAM permission dependencies.
- Secrets and encryption dependencies.
- Container image availability.
- External DNS and certificate dependencies.
- Manually managed infrastructure.
- Missing variables.
- Unresolved resource dependencies.
- External service dependencies.

Requirements:

- Combine deterministic static analysis with AI reasoning.
- Every finding must include evidence.
- Every finding must include severity.
- Every finding must include a recommended action.
- AI-generated assumptions must be labeled separately from verified facts.

Acceptance Criteria:

- Findings reference the relevant Terraform resource or file location.
- Findings are classified as Critical, High, Medium, or Low.
- Unsupported assumptions are clearly identified.
- AI cannot mark an unresolved finding as verified.

## FR-005: Recovery Blueprint

**Description:** Generate a recovery execution plan.

Requirements:

- Generate ordered recovery steps.
- Identify required variables.
- Identify required permissions.
- Identify required external dependencies.
- Identify prerequisites.
- Estimate execution time.
- Identify expected verification conditions.

Acceptance Criteria:

- Blueprint is generated from analyzed infrastructure data.
- Each execution step has a defined outcome.
- Dependencies determine execution order.
- User can review the plan before execution.

## FR-006: Isolated Recovery Runner

**Description:** Rebuild infrastructure in an isolated environment.

Requirements:

- Support a dedicated AWS sandbox account.
- Require explicit user approval before provisioning.
- Use temporary, least-privilege AWS credentials.
- Support Terraform init, validate, plan, and apply.
- Capture execution logs.
- Track resource creation and failures.
- Support automatic cleanup.
- Preserve execution evidence.

Acceptance Criteria:

- Production credentials are never used by the recovery runner.
- Provisioning requires explicit approval.
- Execution logs are associated with a recovery session.
- Cleanup is triggered after completion or failure.
- Failed cleanup operations are reported.

## FR-007: Recovery Verification

**Description:** Verify that rebuilt infrastructure is operational.

Initial verification checks:

- Terraform apply completion.
- Required AWS resource existence.
- ECS service stability.
- ALB target health.
- Application HTTP health endpoint.
- Database connectivity, when configured.

Requirements:

- Support configurable verification checks.
- Record actual execution timestamps.
- Record test results.
- Distinguish infrastructure recovery from application recovery.
- Record failed and skipped checks.

Acceptance Criteria:

- Recovery is successful only when all required checks pass.
- Missing verification configuration is reported.
- A Terraform apply success alone cannot mark the recovery as successful.

## FR-008: AI Remediation

**Description:** Generate infrastructure fixes based on recovery failures.

Requirements:

- Analyze execution errors.
- Identify likely root causes.
- Generate Terraform code suggestions.
- Explain the proposed changes.
- Generate a GitHub Pull Request when authorized.
- Preserve the original source code.

Acceptance Criteria:

- Proposed changes are reviewed before merging.
- Every suggestion references its associated failure.
- AI cannot directly modify production infrastructure.
- Generated code must pass Terraform validation before being proposed.

## FR-009: Recovery Evidence Report

**Description:** Generate an evidence-based recovery report.

Report contents:

- Repository and commit SHA.
- Infrastructure inventory.
- Dependency graph.
- Identified recovery risks.
- Recovery Blueprint.
- Execution history.
- Verification results.
- Failed checks.
- Actual recovery duration.
- Estimated RTO comparison.
- Remediation recommendations.

Acceptance Criteria:

- Report is generated for every completed recovery session.
- All results reference actual execution evidence.
- Failed and skipped checks remain visible.
- Report supports JSON and HTML export.

---

# 4. Recovery Readiness Score

Phoenix calculates a Recovery Readiness Score from verified evidence.

Initial scoring model:

| Category | Weight |
|---|---:|
| IaC Coverage | 20 |
| Dependency Availability | 20 |
| IAM and Secret Readiness | 15 |
| Infrastructure Rebuild | 25 |
| Application Verification | 20 |
| Total | 100 |

Important rules:

- A static analysis result cannot prove actual recoverability.
- Unexecuted recovery tests must be marked as unverified.
- Failed checks must reduce the score.
- Missing evidence must never be interpreted as success.

The dashboard must display the score alongside its underlying evidence.

---

# 5. Non-Functional Requirements

## NFR-001: Security

- Use least-privilege IAM policies.
- Never store long-lived AWS access keys.
- Encrypt sensitive data at rest.
- Redact credentials from logs.
- Require explicit approval for infrastructure provisioning.
- Isolate recovery execution environments.
- Never execute Terraform against production by default.

## NFR-002: Reliability

- Maintain recovery execution history.
- Support retryable operations.
- Capture partial execution failures.
- Make cleanup operations idempotent.
- Preserve evidence when recovery fails.

## NFR-003: Performance

Initial MVP targets:

- Terraform static analysis: under 60 seconds for the demo project.
- Dependency graph rendering: under 3 seconds.
- Recovery report generation: under 15 seconds after verification.
- All performance targets apply to the controlled demo environment.

## NFR-004: Usability

- Provide a guided recovery workflow.
- Display execution progress.
- Explain failures in understandable language.
- Provide evidence for AI recommendations.
- Distinguish actual results from AI-generated suggestions.

---

# 6. Technical Architecture

## 6.1 Technology Stack

| Component | Technology |
|---|---|
| Frontend | Next.js + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Graph Visualization | React Flow |
| Backend | Node.js + TypeScript |
| API | REST |
| Database | PostgreSQL |
| IaC Engine | Terraform CLI |
| Cloud | AWS |
| AI | AWS Bedrock |
| Repository Integration | GitHub API |
| Infrastructure Execution | Isolated AWS Sandbox |
| Testing | Vitest + Playwright |

## 6.2 Core Modules

**Web Console**
- Repository management.
- Infrastructure visualization.
- Recovery dashboard.
- Execution timeline.
- Evidence reports.

**Orchestrator**
- Workflow management.
- Job lifecycle.
- Approval management.
- Recovery session management.

**Terraform Analyzer**
- Terraform parsing.
- Resource inventory.
- Dependency extraction.
- Risk identification.

**AI Recovery Agent**
- Risk analysis.
- Recovery planning.
- Failure analysis.
- Remediation suggestions.

**Recovery Runner**
- Isolated execution.
- Terraform operations.
- Log collection.
- Resource cleanup.

**Verification Engine**
- Infrastructure checks.
- Application health checks.
- RTO measurements.
- Evidence collection.

---

# 7. MVP Scope

## Must Have

- GitHub public repository integration.
- Terraform project analysis.
- Initial AWS resource support.
- Dependency graph.
- Recovery risk analysis.
- AI-generated Recovery Blueprint.
- Isolated recovery execution.
- Application health verification.
- Recovery Evidence Report.

## Should Have

- Private repository integration.
- GitHub Pull Request generation.
- HTML report export.
- Recovery Readiness Score.
- Execution retry.

## Could Have

- Multi-region recovery.
- Scheduled recovery drills.
- Slack notifications.
- Additional Terraform providers.
- Multiple AWS accounts.

## Out of Scope

- Production disaster recovery orchestration.
- Automatic production failover.
- Full AWS resource coverage.
- Kubernetes cluster recovery.
- Multi-cloud support.
- Fully autonomous production remediation.

---

# 8. Demo Scenario

## Scenario: Seoul Region Infrastructure Recovery

A sample AWS infrastructure is defined using Terraform.

The project contains an intentionally introduced recovery dependency issue.

Demo sequence:

1. Connect the GitHub repository.
2. Analyze Terraform resources.
3. Visualize the infrastructure dependency graph.
4. Discover three recovery blockers.
5. Generate the Recovery Blueprint.
6. Approve the isolated recovery execution.
7. Attempt infrastructure rebuild.
8. Demonstrate a failed verification.
9. Generate a Terraform remediation suggestion.
10. Re-run the recovery workflow.
11. Verify infrastructure and application health.
12. Generate the Recovery Evidence Report.

Expected demo outcome:

**RECOVERY VERIFIED**

The application successfully responds to the configured health check after rebuilding the infrastructure from scratch.

All displayed metrics must come from actual execution results.

---

# 9. Success Metrics

MVP success is defined by:

- At least one complete Terraform project analysis.
- At least 10 supported AWS resource types.
- Dependency graph generated successfully.
- At least one intentionally introduced recovery blocker detected.
- Successful isolated rebuild after remediation.
- Successful application health verification.
- Evidence report generated.
- Reproducible demo using a public GitHub repository.

---

# 10. Development Principles

1. Prioritize a complete recovery workflow over broad AWS resource coverage.
2. Separate deterministic infrastructure analysis from AI reasoning.
3. Never trust AI-generated claims without execution evidence.
4. Keep production infrastructure outside the execution boundary.
5. Every recovery operation must be traceable.
6. Build modular components with explicit interfaces.
7. Prefer simple Node.js services over unnecessary microservices.
8. Every major feature must have automated tests.
9. Keep Kiro specifications and project instructions in version control.
10. Optimize for a reproducible three-minute demonstration.

---

# 11. Final Product Definition

Phoenix Protocol is not another infrastructure monitoring dashboard.

It is an infrastructure recovery verification platform.

Its primary output is not a prediction, recommendation, or visualization.

Its primary output is evidence that infrastructure can be rebuilt and that the application can operate again.

**Prove Your Infrastructure Can Rise Again.**