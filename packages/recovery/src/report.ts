import { EvidenceReportSchema, type BlueprintStep, type EvidenceRef, type Finding, type ExecutionSession } from '@phoenix/contracts';
import type { DependencyGraph } from '@phoenix/analyzer';
import type { VerificationResult } from './verification';

export interface EvidenceReportInput {
  sessionId: string;
  repository: string;
  commitSha: string;
  graph: DependencyGraph;
  findings: Finding[];
  blueprint: {
    steps: BlueprintStep[];
    externalDependencies: string[];
    estimatedDurationSeconds: number;
    verificationPlan: string[];
  };
  execution: ExecutionSession;
  verification: VerificationResult;
  evidenceRefs: EvidenceRef[];
  generatedAt: string;
  actualDurationSeconds: number;
}

export interface EvidenceReportDocument {
  status: 'recovery-verified' | 'failed' | 'unverified';
  sessionId: string;
  source: { repository: string; commitSha: string };
  graph: DependencyGraph;
  risks: Finding[];
  blueprint: EvidenceReportInput['blueprint'];
  execution: ExecutionSession;
  verification: VerificationResult;
  duration: { actualSeconds: number; estimatedSeconds: number };
  evidenceRefs: EvidenceRef[];
  generatedAt: string;
}

export interface EvidenceReportResult {
  report: EvidenceReportDocument;
  json: string;
  html: string;
}

export function generateEvidenceReport(input: EvidenceReportInput): EvidenceReportResult {
  const status = input.verification.recoveryVerified
    ? 'recovery-verified'
    : input.verification.checks.some((check) => check.required && check.status === 'failed')
      ? 'failed'
      : 'unverified';

  const report: EvidenceReportDocument = {
    status,
    sessionId: input.sessionId,
    source: { repository: input.repository, commitSha: input.commitSha },
    graph: input.graph,
    risks: input.findings,
    blueprint: input.blueprint,
    execution: input.execution,
    verification: input.verification,
    duration: {
      actualSeconds: input.actualDurationSeconds,
      estimatedSeconds: input.blueprint.estimatedDurationSeconds,
    },
    evidenceRefs: input.evidenceRefs,
    generatedAt: input.generatedAt,
  };

  const baseContract = EvidenceReportSchema.safeParse({
    sessionId: report.sessionId,
    status: report.status,
    source: report.source,
    evidenceRefs: report.evidenceRefs,
    generatedAt: report.generatedAt,
  });
  if (!baseContract.success) throw new Error('Evidence report failed its contract');

  const json = JSON.stringify(report, null, 2);
  return {
    report,
    json,
    html: renderEvidenceReportHtml(report),
  };
}

function renderEvidenceReportHtml(report: EvidenceReportDocument): string {
  const title = `Phoenix Protocol recovery report: ${report.status}`;
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p data-status="${escapeHtml(report.status)}">Status: ${escapeHtml(report.status)}</p>
    <p>Session: ${escapeHtml(report.sessionId)}</p>
    <p>Repository: ${escapeHtml(report.source.repository)} @ ${escapeHtml(report.source.commitSha)}</p>
    <h2>Verification</h2>
    <ul>${report.verification.checks.map((check) => `<li>${escapeHtml(check.id)}: ${escapeHtml(check.status)} — ${escapeHtml(check.message)}</li>`).join('')}</ul>
    <h2>Canonical JSON</h2>
    <pre>${escapeHtml(JSON.stringify(report, null, 2))}</pre>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
