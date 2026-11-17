import { describe, expect, it } from 'vitest';
import { runVerification } from './verification';

describe('runVerification', () => {
  it('marks recovery verified only when every required check passes', async () => {
    const result = await runVerification({
      sessionId: 'session-1',
      checks: [
        { id: 'terraform-apply', layer: 'infrastructure', required: true, run: async () => ({ status: 'passed', message: 'Apply completed', evidence: [] }) },
        { id: 'http-health', layer: 'application', required: true, run: async () => ({ status: 'passed', message: 'HTTP 200', evidence: [] }) },
      ],
    });

    expect(result.recoveryVerified).toBe(true);
    expect(result.requiredPassed).toBe(2);
  });

  it('does not treat apply success as application recovery', async () => {
    const result = await runVerification({
      sessionId: 'session-1',
      checks: [
        { id: 'terraform-apply', layer: 'infrastructure', required: true, run: async () => ({ status: 'passed', message: 'Apply completed', evidence: [] }) },
        { id: 'http-health', layer: 'application', required: true, run: async () => ({ status: 'failed', message: 'HTTP endpoint unavailable', evidence: [] }) },
      ],
    });

    expect(result.recoveryVerified).toBe(false);
    expect(result.checks.find((check) => check.id === 'http-health')?.status).toBe('failed');
  });

  it('preserves skipped and unverified checks with explicit reasons', async () => {
    const result = await runVerification({
      sessionId: 'session-1',
      checks: [
        { id: 'database-connectivity', layer: 'application', required: false, run: async () => ({ status: 'skipped', message: 'Database is not configured', evidence: [] }) },
        { id: 'alb-target-health', layer: 'infrastructure', required: true, run: async () => ({ status: 'unverified', message: 'No target health evidence', evidence: [] }) },
      ],
    });

    expect(result.recoveryVerified).toBe(false);
    expect(result.checks.map((check) => check.status)).toEqual(['skipped', 'unverified']);
  });

  it('converts thrown check errors into failed evidence instead of stopping all checks', async () => {
    const result = await runVerification({
      sessionId: 'session-1',
      checks: [
        { id: 'resource-exists', layer: 'infrastructure', required: true, run: async () => { throw new Error('resource lookup failed'); } },
        { id: 'http-health', layer: 'application', required: false, run: async () => ({ status: 'passed', message: 'HTTP 200', evidence: [] }) },
      ],
    });

    expect(result.checks[0]).toEqual(expect.objectContaining({ status: 'failed', message: 'resource lookup failed' }));
    expect(result.checks[1].status).toBe('passed');
  });
});
