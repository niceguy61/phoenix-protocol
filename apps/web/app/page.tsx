'use client';

import { FormEvent, useState } from 'react';

type AnalysisResponse = {
  analysisId: string;
  status: 'analysis-complete';
  awsProfile: 'default' | 'sandbox';
  snapshot: {
    repository: string;
    ref: string;
    commitSha: string;
    terraformRoot: string;
    snapshotId: string;
  };
  analysis: { resources: unknown[]; filesAnalyzed: string[]; diagnostics: unknown[] };
  graph: { nodes: Array<{ id: string; kind: string; status: string }>; unresolved: string[]; externalInputs?: string[]; cycles: string[] };
  risks: { findings: Array<{ severity: string; summary: string }>; diagnostics: string[] };
  blueprint: { steps: Array<{ id: string; approvalRequired: boolean }> } | null;
};

type AwsInventoryResponse = {
  profile: 'default' | 'sandbox';
  region: string;
  accountId: string;
  collectedAt: string;
  resources: Array<{ id: string; kind: string; status: string; name?: string; metadata?: Record<string, string> }>;
};

type NimEvaluationResponse = {
  model: string;
  promptVersion: string;
  results: Array<{ name: string; passed: boolean; expectedOutcome: 'accept' | 'block'; observedOutcome: 'accepted' | 'blocked'; violations: string[] }>;
  summary: { passed: boolean; total: number; passedCount: number; failedCases: string[] };
};

type RecoveryResponse = {
  sessionId: string;
  session: { status: 'awaiting-approval' | 'approved' | 'running' | 'verifying' | 'failed' | 'cleaned' };
  verification?: { recoveryVerified: boolean; requiredPassed: number; requiredTotal: number; checks: Array<{ id: string; status: string; message: string; required: boolean }> };
  report?: { report: { status: string; risks: Array<{ severity: string; summary: string }>; verification: { checks: Array<{ id: string; status: string }> } } ; json: string; html: string };
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:4000';

export default function HomePage() {
  const [repositoryUrl, setRepositoryUrl] = useState('https://github.com/niceguy61/phoenix-protocol');
  const [ref, setRef] = useState('feature/initial-scaffold');
  const [terraformRoot, setTerraformRoot] = useState('.');
  const [awsProfile, setAwsProfile] = useState<'default' | 'sandbox'>('default');
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [inventory, setInventory] = useState<AwsInventoryResponse | null>(null);
  const [nimEvaluation, setNimEvaluation] = useState<NimEvaluationResponse | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryResponse | null>(null);
  const [isRecoveryActionPending, setIsRecoveryActionPending] = useState(false);

  async function scanAwsInventory() {
    setError('');
    try {
      const response = await fetch(`${apiBase}/api/aws/inventory?profile=${awsProfile}&region=ap-northeast-2`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? 'AWS inventory scan failed.');
      setInventory(payload as AwsInventoryResponse);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'AWS inventory scan failed.');
    }
  }

  async function createRecoverySession() {
    if (!analysis) return;
    setError('');
    setIsRecoveryActionPending(true);
    try {
      const response = await fetch(`${apiBase}/api/recovery-sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ analysisId: analysis.analysisId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? 'Recovery session could not be created.');
      setRecovery(payload as RecoveryResponse);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Recovery session could not be created.');
    } finally {
      setIsRecoveryActionPending(false);
    }
  }

  async function approveRecoverySession() {
    if (!recovery) return;
    setIsRecoveryActionPending(true);
    try {
      const response = await fetch(`${apiBase}/api/recovery-sessions/${recovery.sessionId}/approve`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? 'Recovery approval failed.');
      setRecovery(payload as RecoveryResponse);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Recovery approval failed.');
    } finally {
      setIsRecoveryActionPending(false);
    }
  }

  async function runRecoverySession() {
    if (!recovery) return;
    setIsRecoveryActionPending(true);
    try {
      const response = await fetch(`${apiBase}/api/recovery-sessions/${recovery.sessionId}/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scenario: 'success' }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? 'Recovery execution failed.');
      setRecovery(payload as RecoveryResponse);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Recovery execution failed.');
    } finally {
      setIsRecoveryActionPending(false);
    }
  }

  function downloadReport(format: 'json' | 'html') {
    const content = recovery?.report?.[format];
    if (!content || !recovery) return;
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/html' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `phoenix-recovery-${recovery.sessionId}.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function submitAnalysis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setAnalysis(null);
    setRecovery(null);
    setInventory(null);
    setNimEvaluation(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiBase}/api/analyses`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ repositoryUrl, ref, terraformRoot, awsProfile }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? 'Analysis could not be started.');
        return;
      }
      setAnalysis(payload as AnalysisResponse);
      const evaluationResponse = await fetch(`${apiBase}/api/evaluations/nim`);
      if (evaluationResponse.ok) setNimEvaluation(await evaluationResponse.json() as NimEvaluationResponse);
    } catch {
      setError('API is unavailable. Start the Phoenix API on port 4000 and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="Phoenix Protocol home">
          <span className="wordmark-mark" aria-hidden="true">P</span>
          <span>Phoenix Protocol</span>
        </a>
        <span className="status-pill"><span className="status-dot" /> Local proof environment</span>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow">Infrastructure recovery verification</div>
        <h1>Prove your infrastructure can rise again.</h1>
        <p className="hero-copy">
          Pin a Terraform repository to an immutable commit, expose its recovery dependencies,
          and build an evidence trail before you trust the rebuild.
        </p>
        <div className="hero-meta">
          <span><strong>01</strong> Snapshot the source</span>
          <span><strong>02</strong> Find blockers</span>
          <span><strong>03</strong> Verify recovery</span>
        </div>
      </section>

      <section className="workspace-grid" aria-label="Recovery workspace">
        <article className="panel source-panel">
          <div className="panel-heading">
            <div>
              <div className="section-label">Start a recovery analysis</div>
              <h2>Source snapshot</h2>
            </div>
            <span className="step-index">01</span>
          </div>
          <p className="panel-copy">The API resolves the selected ref to a commit SHA before analysis begins.</p>
          <form onSubmit={submitAnalysis} className="source-form">
            <label>
              GitHub repository
              <input value={repositoryUrl} onChange={(event) => setRepositoryUrl(event.target.value)} type="url" required />
            </label>
            <div className="field-row">
              <label>
                Branch or ref
                <input value={ref} onChange={(event) => setRef(event.target.value)} required />
              </label>
              <label>
                Terraform root
                <input value={terraformRoot} onChange={(event) => setTerraformRoot(event.target.value)} required />
              </label>
            </div>
            <label>
              AWS test profile
              <select value={awsProfile} onChange={(event) => setAwsProfile(event.target.value as 'default' | 'sandbox')}>
                <option value="default">default · SSO profile</option>
                <option value="sandbox">sandbox · gated</option>
              </select>
              <small className="field-hint">Profile name only. Credentials never enter browser state.</small>
            </label>
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Resolving commit…' : 'Resolve source snapshot'}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <button className="secondary-button live-scan-button" type="button" onClick={scanAwsInventory}>Scan live AWS inventory</button>
          {inventory && (
            <div className="inventory-card" role="status" aria-label="Live AWS inventory">
              <div className="recovery-card-header"><span>Live AWS inventory</span><strong>{inventory.profile} · {inventory.region}</strong></div>
              <div className="inventory-metrics">{['vpc', 'ec2-instance', 'ecs-cluster', 'load-balancer', 'rds-instance', 's3-bucket', 'dynamodb-table', 'lambda-function'].map((kind) => <div key={kind}><strong>{inventory.resources.filter((resource) => resource.kind === kind).length}</strong><span>{kind}</span></div>)}</div>
              <small className="field-hint">Account: {inventory.accountId} · Read-only snapshot at {new Date(inventory.collectedAt).toLocaleTimeString()}</small>
            </div>
          )}
          {error && <p className="message error" role="alert">{error}</p>}
          {analysis && (
            <>
              <div className="message success" role="status">
                <strong>Snapshot pinned.</strong>
                <span>{analysis.snapshot.repository} · {analysis.snapshot.commitSha.slice(0, 12)} · {analysis.snapshot.terraformRoot} · AWS profile: {analysis.awsProfile}</span>
              </div>
              <div className="analysis-overview" aria-label="Analysis result">
                <div><strong>{analysis.analysis.resources.length}</strong><span>resources</span></div>
                <div><strong>{analysis.graph.externalInputs?.length ?? 0}</strong><span>external inputs</span></div>
                <div><strong>{analysis.risks.findings.length}</strong><span>risk findings</span></div>
                <div><strong>{analysis.blueprint?.steps.length ?? 0}</strong><span>blueprint steps</span></div>
              </div>
              {!recovery && (
                <button className="secondary-button" type="button" onClick={createRecoverySession} disabled={isRecoveryActionPending || !analysis.blueprint}>
                  {isRecoveryActionPending ? 'Creating session…' : 'Create mock recovery session'}
                  <span aria-hidden="true">→</span>
                </button>
              )}
              {recovery && (
                <div className="recovery-card" role="region" aria-label="Recovery session">
                  <div className="recovery-card-header"><span>Recovery session</span><strong>{recovery.session.status}</strong></div>
                  {recovery.session.status === 'awaiting-approval' && <button className="secondary-button" type="button" onClick={approveRecoverySession} disabled={isRecoveryActionPending}>Approve mock execution</button>}
                  {recovery.session.status === 'approved' && <button className="primary-button" type="button" onClick={runRecoverySession} disabled={isRecoveryActionPending}>Run mock recovery <span aria-hidden="true">→</span></button>}
                  {recovery.verification && <p className={recovery.verification.recoveryVerified ? 'recovery-result pass' : 'recovery-result fail'}>{recovery.verification.recoveryVerified ? 'RECOVERY VERIFIED' : `Verification incomplete · ${recovery.verification.requiredPassed}/${recovery.verification.requiredTotal} required checks passed`}</p>}
                </div>
              )}
            </>
          )}
        </article>

        <aside className="panel evidence-panel">
          <div className="panel-heading">
            <div>
              <div className="section-label">Evidence pipeline</div>
              <h2>Recovery proof</h2>
            </div>
            <span className="step-index muted">02—05</span>
          </div>
          <ol className="pipeline">
            <li className="active"><span>02</span><div><strong>Terraform analysis</strong><small>Resource inventory and source locators</small></div></li>
            <li><span>03</span><div><strong>Dependency graph</strong><small>Prerequisites and unresolved edges</small></div></li>
            <li><span>04</span><div><strong>Recovery Blueprint</strong><small>Ordered steps before approval</small></div></li>
            <li><span>05</span><div><strong>Verification report</strong><small>Infrastructure and application checks</small></div></li>
          </ol>
          <div className="evidence-note">
            <span className="note-icon" aria-hidden="true">i</span>
            <p>AI suggestions remain separate from verified execution evidence.</p>
          </div>
        </aside>
      </section>

      {analysis && (
        <section className="details-grid" aria-label="Analysis evidence details">
          <article className="panel detail-panel">
            <div className="panel-heading"><div><div className="section-label">Dependency evidence</div><h2>Graph</h2></div><span className="step-index">{analysis.graph.nodes.length} nodes</span></div>
            <ul className="compact-list">
              {analysis.graph.nodes.slice(0, 8).map((node) => <li key={node.id}><span className="node-dot" /><span>{node.id}</span><small className="node-status">{node.kind} · {node.status}</small></li>)}
            </ul>
            {analysis.graph.externalInputs && analysis.graph.externalInputs.length > 0 && <p className="detail-inputs">External inputs: {analysis.graph.externalInputs.join(', ')}</p>}
            {analysis.graph.unresolved.length > 0 && <p className="detail-warning">Unresolved resources: {analysis.graph.unresolved.join(', ')}</p>}
            {analysis.graph.unresolved.length === 0 && <p className="detail-muted">No unresolved dependencies in this snapshot.</p>}
          </article>
          <article className="panel detail-panel">
            <div className="panel-heading"><div><div className="section-label">Recovery blockers</div><h2>Risk findings</h2></div><span className="step-index">{analysis.risks.findings.length}</span></div>
            <ul className="compact-list risk-list">
              {analysis.risks.findings.slice(0, 5).map((finding, index) => <li key={`${finding.summary}-${index}`}><span className={`severity severity-${finding.severity}`}>{finding.severity}</span><span>{finding.summary}</span></li>)}
            </ul>
            {analysis.risks.findings.length === 0 && <p className="detail-muted">No deterministic findings returned.</p>}
          </article>
          <article className="panel detail-panel full-width">
            <div className="panel-heading"><div><div className="section-label">Ordered recovery plan</div><h2>Blueprint</h2></div><span className="step-index">{analysis.blueprint?.steps.length ?? 0} steps</span></div>
            <ol className="blueprint-list">
              {(analysis.blueprint?.steps ?? []).map((step, index) => <li key={step.id}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{step.id}</strong><small>{step.approvalRequired ? 'Explicit approval required' : 'Preflight step'}</small></div></li>)}
            </ol>
          </article>
          {nimEvaluation && (
            <article className="panel detail-panel full-width">
              <div className="panel-heading"><div><div className="section-label">AI contract evaluation</div><h2>NVIDIA NIM</h2></div><span className={`step-index ${nimEvaluation.summary.passed ? '' : 'muted'}`}>{nimEvaluation.summary.passedCount}/{nimEvaluation.summary.total} passed</span></div>
              <ul className="verification-list">
                {nimEvaluation.results.map((result) => <li key={result.name}><span>{result.name}</span><strong className={result.passed ? 'check-pass' : 'check-fail'}>{result.observedOutcome === 'blocked' ? 'blocked as expected' : result.passed ? 'passed' : 'failed'}</strong><small>{result.violations.join(' ') || 'Schema, grounding, separation, and safety checks passed.'}</small></li>)}
              </ul>
              <p className="detail-muted">Model: {nimEvaluation.model} · Prompt: {nimEvaluation.promptVersion}</p>
            </article>
          )}
          {recovery?.verification && (
            <article className="panel detail-panel full-width">
              <div className="panel-heading"><div><div className="section-label">Execution evidence</div><h2>Verification report</h2></div><span className={`step-index ${recovery.verification.recoveryVerified ? '' : 'muted'}`}>{recovery.verification.recoveryVerified ? 'VERIFIED' : 'INCOMPLETE'}</span></div>
              <ul className="verification-list">
                {recovery.verification.checks.map((check) => <li key={check.id}><span>{check.id}</span><strong className={check.status === 'passed' ? 'check-pass' : 'check-fail'}>{check.status}</strong><small>{check.message}</small></li>)}
              </ul>
              {recovery.report && (
                <>
                  <p className="detail-muted">Canonical report status: {recovery.report.report.status}</p>
                  <div className="report-actions">
                    <button className="secondary-button" type="button" onClick={() => downloadReport('json')}>Download JSON report</button>
                    <button className="secondary-button" type="button" onClick={() => downloadReport('html')}>Download HTML report</button>
                  </div>
                </>
              )}
            </article>
          )}
        </section>
      )}

      <footer className="footer-line">
        <span>Built with Kiro + Kiro Crew</span>
        <span>NVIDIA NIM evaluation · AWS sandbox gated</span>
      </footer>
    </main>
  );
}
