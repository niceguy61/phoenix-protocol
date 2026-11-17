'use client';

import { FormEvent, useState } from 'react';

type AnalysisResponse = {
  analysisId: string;
  status: 'analysis-complete';
  snapshot: {
    repository: string;
    ref: string;
    commitSha: string;
    terraformRoot: string;
    snapshotId: string;
  };
  analysis: { resources: unknown[]; filesAnalyzed: string[]; diagnostics: unknown[] };
  graph: { nodes: unknown[]; unresolved: string[]; cycles: string[] };
  risks: { findings: Array<{ severity: string; summary: string }>; diagnostics: string[] };
  blueprint: { steps: Array<{ id: string; approvalRequired: boolean }> } | null;
};

type RecoveryResponse = {
  sessionId: string;
  session: { status: 'awaiting-approval' | 'approved' | 'running' | 'verifying' | 'failed' | 'cleaned' };
  verification?: { recoveryVerified: boolean; requiredPassed: number; requiredTotal: number };
  report?: { report: { status: string } };
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:4000';

export default function HomePage() {
  const [repositoryUrl, setRepositoryUrl] = useState('https://github.com/niceguy61/phoenix-protocol');
  const [ref, setRef] = useState('feature/initial-scaffold');
  const [terraformRoot, setTerraformRoot] = useState('.');
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryResponse | null>(null);
  const [isRecoveryActionPending, setIsRecoveryActionPending] = useState(false);

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

  async function submitAnalysis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setAnalysis(null);
    setRecovery(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiBase}/api/analyses`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ repositoryUrl, ref, terraformRoot }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? 'Analysis could not be started.');
        return;
      }
      setAnalysis(payload as AnalysisResponse);
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
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Resolving commit…' : 'Resolve source snapshot'}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          {error && <p className="message error" role="alert">{error}</p>}
          {analysis && (
            <>
              <div className="message success" role="status">
                <strong>Snapshot pinned.</strong>
                <span>{analysis.snapshot.repository} · {analysis.snapshot.commitSha.slice(0, 12)} · {analysis.snapshot.terraformRoot}</span>
              </div>
              <div className="analysis-overview" aria-label="Analysis result">
                <div><strong>{analysis.analysis.resources.length}</strong><span>resources</span></div>
                <div><strong>{analysis.graph.unresolved.length}</strong><span>unresolved</span></div>
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

      <footer className="footer-line">
        <span>Built with Kiro + Kiro Crew</span>
        <span>NVIDIA NIM evaluation · AWS sandbox gated</span>
      </footer>
    </main>
  );
}
