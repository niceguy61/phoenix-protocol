# Spec: `dependency-graph`

## Objective
Terraform 분석 결과를 resource/module/data source node와 directed edge로 변환해 recovery order와 unresolved dependency를 표시할 수 있게 한다.

## Contract

```json
{
  "nodes": [{"id":"aws_vpc.main","kind":"resource","service":"vpc","status":"resolved"}],
  "edges": [{"from":"aws_subnet.app","to":"aws_vpc.main","kind":"reference"}],
  "unresolved": []
}
```

Node id는 분석 결과에서 안정적으로 파생한다. edge direction은 dependent에서 prerequisite로 통일한다.

## Behavior

- resource, module, data source를 node로 만든다.
- implicit reference와 explicit dependency를 edge로 표현한다.
- 외부 prerequisite와 unresolved reference를 별도 상태로 표시한다.
- graph cycle을 감지하고 오류로 숨기지 않는다.
- UI와 report가 사용할 수 있도록 JSON export를 제공한다.
- graph 생성은 NIM 호출 없이 수행한다.

## Commands

- Type check: `npm run typecheck`
- Unit tests: `npm test -- dependency-graph`
- Fixture tests: `npm run test:fixtures -- dependency-graph`

## Testing Strategy

- linear, branching, cycle, unresolved, external dependency fixture를 사용한다.
- 같은 analyzer output에 대해 node/edge id가 안정적인지 검사한다.
- unresolved node가 resolved 또는 zero-score로 변환되지 않는지 검사한다.
- graph JSON schema와 export/import round trip을 검증한다.

## Boundaries

- Always: stable IDs, directed edge convention, unresolved 상태 보존, JSON schema validation
- Ask first: layout algorithm, graph database 도입, cross-repository dependency 표시
- Never: unresolved dependency를 정상 dependency로 표시, graph display를 위해 source evidence 삭제

## Success Criteria

- [ ] 분석 결과와 graph node/edge가 일치한다.
- [ ] 미해결 dependency가 시각적으로 구분 가능한 상태로 export된다.
- [ ] node 선택에 필요한 metadata와 source locator가 유지된다.
- [ ] graph가 JSON으로 재현된다.
