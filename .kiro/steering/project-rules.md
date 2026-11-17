---
inclusion: always
name: phoenix-project-rules
description: Phoenix Protocol project structure, workflow, and evidence rules
---

# Phoenix Protocol Project Rules

- Read `docs/spec.md` and the relevant `docs/specs/SPEC-<module-id>.md` before changing implementation.
- Keep deterministic infrastructure facts separate from NIM-generated inference, assumption, and recommendation.
- Treat `tasks/plan.md` and `tasks/todo.md` as the implementation order and update task status only after verification.
- Keep module contracts in `packages/contracts`; do not create implicit cross-module data shapes.
- Use the existing target commands: `npm run typecheck`, `npm test`, `npm run test:nim`, `npm run test:e2e`, and `npm run build`.
- First make the local/mock recovery path pass. Do not enable AWS execution while sandbox preflight is incomplete.
- Keep UI behavior connected to real API responses. Do not replace unavailable data with fake success or zero scores.
- Use Noto Sans KR as the default Korean UI font.
