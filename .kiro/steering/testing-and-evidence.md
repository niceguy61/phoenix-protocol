---
inclusion: always
name: phoenix-testing-and-evidence
description: Test strategy and evidence-first completion criteria
---

# Phoenix Protocol Testing and Evidence Rules

- Add deterministic unit or contract tests for every new module behavior.
- Add a NIM golden or adversarial fixture when AI output affects a contract.
- Test invalid, partial, unavailable, skipped, and cleanup-failed states, not only success.
- A Terraform apply success is never sufficient for recovery success; required infrastructure and application checks must pass.
- Every result must retain a source locator, execution timestamp, session ID, or an explicit reason why evidence is unavailable.
- Verify with the narrowest focused test first, then run `npm run typecheck`, `npm test`, and the relevant build or E2E command.
- Do not weaken tests, delete failing assertions, add suppression comments, or treat an unconfigured test command as a pass.
- Do not run real AWS recovery tests without an explicit sandbox target and approval.
