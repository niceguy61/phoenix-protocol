# Spec: `web-console`

## Objective
사용자가 recovery workflow를 안내받고, 분석 결과를 검토하고, blueprint를 승인하고, 실행 진행과 evidence report를 확인할 수 있는 Next.js console을 만든다.

## Primary Flow

1. public GitHub repository, branch, Terraform root 선택
2. commit-pinned analysis 시작 및 진행률 확인
3. dependency graph와 node metadata 확인
4. risk findings와 evidence 검토
5. Recovery Blueprint 검토 및 명시적 approval
6. mock recovery execution 진행률 확인
7. infrastructure/application verification 결과 확인
8. JSON/HTML evidence report 열기

## UI State Rules

- loading, empty, failed, partial, unverified 상태를 구분한다.
- unresolved graph dependency를 0점 또는 resolved로 표시하지 않는다.
- AI assumption/recommendation과 verified fact를 서로 다른 시각적 영역에 둔다.
- provisioning approval 전에는 apply 진행 상태를 표시하지 않는다.
- UI는 backend API가 실제로 반환한 데이터를 렌더링하며 local fake success로 대체하지 않는다.

## API Boundary

console은 `repository-integration`, `terraform-analysis`, `dependency-graph`, `recovery-risk`, `recovery-blueprint`, `recovery-runner`, `verification`, `evidence-report`의 public contracts만 소비한다. NIM endpoint와 AWS credential은 browser에 노출하지 않는다.

## Commands

- Development: `npm run dev`
- Type check: `npm run typecheck`
- Unit/component tests: `npm test -- web-console`
- E2E tests: `npm run test:e2e`
- Production build: `npm run build`

## Testing Strategy

- component test로 각 result state와 evidence rendering을 검증한다.
- Playwright로 public repo 선택부터 report 확인까지 mock backend vertical slice를 검증한다.
- approval 전후 runner 호출 여부를 network assertion으로 검증한다.
- browser에 NIM/AWS secret이 전달되지 않는지 E2E와 build configuration을 검사한다.
- 접근성 검사와 keyboard navigation을 포함한다.

## Boundaries

- Always: Noto Sans KR 우선, evidence-first UI, responsive layout, accessible controls, backend response rendering
- Ask first: 인증 provider, private repository UX, report sharing, destructive action UX
- Never: browser에서 NIM/AWS API 직접 호출, approval 없는 apply button 자동 실행, unavailable 데이터를 0점으로 표시

## Success Criteria

- [ ] 사용자가 guided recovery workflow를 끝까지 탐색할 수 있다.
- [ ] graph, risk, blueprint, timeline, verification, report가 실제 API 응답으로 표시된다.
- [ ] approval 전후 실행 경계가 명확하다.
- [ ] failed/skipped/unverified 상태가 UI에서 보인다.
- [ ] Playwright vertical slice와 production build가 통과한다.
