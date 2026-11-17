import { VerificationCheckSchema, type EvidenceRef } from '@phoenix/contracts';

export type VerificationStatus = 'passed' | 'failed' | 'skipped' | 'unverified';
export type VerificationLayer = 'infrastructure' | 'application';

export interface VerificationObservation {
  status: VerificationStatus;
  message: string;
  evidence: EvidenceRef[];
}

export interface VerificationDefinition {
  id: string;
  layer: VerificationLayer;
  required: boolean;
  run: () => Promise<VerificationObservation> | VerificationObservation;
}

export interface VerificationInput {
  sessionId: string;
  checks: VerificationDefinition[];
  now?: () => Date;
}

export interface VerificationResult {
  checks: Array<ReturnType<typeof VerificationCheckSchema.parse>>;
  requiredPassed: number;
  requiredTotal: number;
  recoveryVerified: boolean;
}

export async function runVerification(input: VerificationInput): Promise<VerificationResult> {
  const now = input.now ?? (() => new Date());
  const checks: VerificationResult['checks'] = [];

  for (const definition of input.checks) {
    const startedAt = now().toISOString();
    let observation: VerificationObservation;
    try {
      observation = await definition.run();
    } catch (error) {
      observation = {
        status: 'failed',
        message: error instanceof Error ? error.message : 'Verification check failed',
        evidence: [],
      };
    }
    const check = VerificationCheckSchema.parse({
      id: definition.id,
      layer: definition.layer,
      required: definition.required,
      status: observation.status,
      startedAt,
      completedAt: now().toISOString(),
      evidence: observation.evidence,
      message: observation.message,
    });
    checks.push(check);
  }

  const requiredChecks = checks.filter((check) => check.required);
  const requiredPassed = requiredChecks.filter((check) => check.status === 'passed').length;
  return {
    checks,
    requiredPassed,
    requiredTotal: requiredChecks.length,
    recoveryVerified: requiredChecks.length > 0 && requiredPassed === requiredChecks.length,
  };
}
