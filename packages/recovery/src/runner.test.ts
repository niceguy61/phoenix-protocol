import { describe, expect, it } from 'vitest';
import { MockRecoveryRunner, RecoveryExecutionError } from './runner';

describe('MockRecoveryRunner', () => {
  it('requires explicit approval before execution', async () => {
    const runner = new MockRecoveryRunner({ now: () => new Date('2026-11-17T00:00:00.000Z') });
    const session = runner.createSession({
      sessionId: 'session-1',
      commitSha: '0123456789abcdef0123456789abcdef01234567',
    });

    await expect(runner.execute(session.sessionId)).rejects.toBeInstanceOf(RecoveryExecutionError);
    expect(runner.getSession(session.sessionId).status).toBe('awaiting-approval');
  });

  it('runs the approved mock lifecycle and preserves execution evidence', async () => {
    const runner = new MockRecoveryRunner({ now: () => new Date('2026-11-17T00:00:00.000Z') });
    runner.createSession({ sessionId: 'session-1', commitSha: '0123456789abcdef0123456789abcdef01234567' });
    runner.approve('session-1');

    const result = await runner.execute('session-1', 'success');

    expect(result.session.status).toBe('verifying');
    expect(result.createdResources).toEqual([
      { type: 'aws_vpc', id: 'mock-vpc-session-1' },
      { type: 'aws_subnet', id: 'mock-subnet-session-1' },
    ]);
    expect(result.logs.join('\n')).not.toContain('NVIDIA_API_KEY');
  });

  it('preserves apply and cleanup failures', async () => {
    const runner = new MockRecoveryRunner({ now: () => new Date('2026-11-17T00:00:00.000Z') });
    runner.createSession({ sessionId: 'session-1', commitSha: '0123456789abcdef0123456789abcdef01234567' });
    runner.approve('session-1');

    const result = await runner.execute('session-1', 'apply-failure');
    expect(result.session.status).toBe('failed');
    expect(result.failure?.code).toBe('APPLY_FAILED');

    const cleanup = await runner.cleanup('session-1', 'success');
    expect(cleanup.session.status).toBe('cleaned');
    expect(cleanup.logs.join('\n')).toContain('cleanup completed');
  });

  it('records cleanup-failed instead of hiding cleanup errors', async () => {
    const runner = new MockRecoveryRunner({ now: () => new Date('2026-11-17T00:00:00.000Z') });
    runner.createSession({ sessionId: 'session-1', commitSha: '0123456789abcdef0123456789abcdef01234567' });
    runner.approve('session-1');
    await runner.execute('session-1', 'success');

    const cleanup = await runner.cleanup('session-1', 'cleanup-failure');
    expect(cleanup.session.status).toBe('cleanup-failed');
    expect(cleanup.failure?.code).toBe('CLEANUP_FAILED');
  });
});
