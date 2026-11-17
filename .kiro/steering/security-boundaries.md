---
inclusion: always
name: phoenix-security-boundaries
description: Secret handling, AI safety, and AWS execution boundaries
---

# Phoenix Protocol Security Boundaries

- Never read, print, commit, or send the value of `.env` or `NVIDIA_API_KEY` to the browser.
- The API server is the only component allowed to call NVIDIA NIM.
- Redact API keys, tokens, private keys, secrets, and credential-like values from logs and reports.
- Treat every NIM claim as unverified until it is grounded in deterministic evidence.
- Never let AI output directly invoke Terraform, AWS, GitHub writes, or production changes.
- Require explicit approval before any Terraform apply or destroy.
- AWS execution must use an allowlisted sandbox target, temporary least-privilege credentials, TTL, and idempotent cleanup.
- Preserve failed, skipped, unverified, and cleanup-failed evidence. Do not convert it into success.
- Ask before adding dependencies, changing IAM policy, connecting an AWS account, or changing data retention.
