# Task: Phoenix Protocol local/mock MVP implementation

## Objective
Implement the approved Phoenix Protocol MVP from the existing specs and plan. Work only through the local/mock recovery proof and NIM evaluation. Do not implement or invoke the real AWS sandbox in this task.

## Required context

- Read `.kiro/specs/phoenix-protocol/requirements.md`.
- Read `.kiro/specs/phoenix-protocol/design.md`.
- Follow `.kiro/specs/phoenix-protocol/tasks.md` and update it only after acceptance criteria and verification pass.
- Read the relevant module specs under `docs/specs/` before each task.
- Follow `.kiro/steering/**/*.md`.
- Use `tasks/plan.md` and `tasks/todo.md` as compatibility references for the dashboard task runner.

## Execution steps

1. Complete Tasks 1-3 in `tasks/todo.md`: scaffold the TypeScript workspace, define shared contracts, and implement the managed NVIDIA NIM adapter using `NVIDIA_BASE_URL` and `NVIDIA_MODEL` from the environment.
2. Complete Tasks 4-7: public GitHub commit-pinned snapshot, deterministic Terraform analysis, dependency graph, and recovery risk analysis.
3. Complete Tasks 8-11: Recovery Blueprint, local/mock runner, verification, and canonical JSON/HTML evidence report.
4. Complete Tasks 12-13: REST/web console integration and NIM golden/adversarial evaluation.
5. At every checkpoint, run the focused verification before moving forward.
6. Stop after the local/mock end-to-end vertical slice and report remaining work for AWS sandbox integration.

## Hard boundaries

- Never read, print, commit, or expose `.env` contents or `NVIDIA_API_KEY`.
- Never call the real AWS API, run Terraform apply/destroy against AWS, modify IAM, or connect an AWS account.
- Never treat an NIM response as verified infrastructure evidence.
- Do not delete or weaken tests to make a task pass.
- Do not add private GitHub integration, multi-region support, readiness score, or automatic GitHub PR generation in this task.

## Verification

Run the narrowest focused tests after each task, then run:

- `npm run typecheck`
- `npm test`
- `npm run test:nim`
- `npm run test:e2e`
- `npm run build`

If a command cannot run because the scaffold is not ready, record the exact reason and fix the scaffold before proceeding. Do not claim the task is complete without verification evidence.
