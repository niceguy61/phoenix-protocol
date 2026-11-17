# Spec: `repository-integration`

## Objective
GitHub public repository에서 선택한 branch와 Terraform root module을 immutable source snapshot으로 확보하고 분석 session에 commit SHA를 연결한다.

## Inputs and Outputs

입력은 repository URL, branch/ref, Terraform root path다. 출력은 repository metadata, resolved commit SHA, normalized root path, source snapshot reference다.

```json
{
  "repository": "owner/name",
  "ref": "main",
  "commitSha": "<40-hex-sha>",
  "terraformRoot": "infra/terraform",
  "snapshotId": "snapshot_<id>"
}
```

## Behavior

- public GitHub repository와 branch를 조회한다.
- branch를 commit SHA로 resolve한 뒤 이후 분석은 SHA 기준으로 수행한다.
- root path가 repository 내부인지 검증한다.
- Terraform 파일과 필요한 module 파일을 snapshot에 포함한다.
- token, private URL credential, webhook secret을 로그에 기록하지 않는다.
- network failure, missing branch, missing root, empty Terraform root를 actionable error로 반환한다.
- private repository는 이 spec의 범위에서 지원하지 않는다.

## Commands

- Type check: `npm run typecheck`
- Unit tests: `npm test -- repository-integration`
- Integration tests: `npm run test:integration -- repository-integration`

## Testing Strategy

- GitHub API 응답 fixture로 branch-to-SHA 고정과 pagination을 검증한다.
- path traversal, invalid URL, nonexistent root, missing commit을 실패시킨다.
- 같은 SHA를 두 번 요청하면 동일한 snapshot identity를 얻는지 검증한다.
- GitHub 오류 메시지가 credential을 포함하지 않는지 검사한다.

## Boundaries

- Always: commit SHA 기록, root path 정규화, credential redaction, snapshot identity 보존
- Ask first: private GitHub OAuth/App, clone cache retention, source retention 기간
- Never: branch 이름만으로 분석 결과를 식별, repository token을 client에 반환, 임의 URL을 fetch 대상으로 허용

## Success Criteria

- [ ] 사용자가 public repository, branch, Terraform root를 선택할 수 있다.
- [ ] 분석 session은 immutable commit SHA를 가진다.
- [ ] root 밖의 파일 접근이 거부된다.
- [ ] snapshot 오류가 분석 실패 원인과 함께 표시된다.
