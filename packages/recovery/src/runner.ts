import { ExecutionSessionSchema, type ExecutionSession } from '@phoenix/contracts';

export type MockScenario = 'success' | 'plan-failure' | 'apply-failure';
export type CleanupScenario = 'success' | 'cleanup-failure';

export interface MockRecoveryRunnerOptions {
  now?: () => Date;
}

export interface CreateSessionInput {
  sessionId: string;
  commitSha: string;
}

export interface MockResource {
  type: string;
  id: string;
}

export interface ExecutionFailure {
  code: 'PLAN_FAILED' | 'APPLY_FAILED' | 'CLEANUP_FAILED';
  message: string;
}

export interface ExecutionResult {
  session: ExecutionSession;
  logs: string[];
  createdResources: MockResource[];
  failure?: ExecutionFailure;
}

export class RecoveryExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecoveryExecutionError';
  }
}

export class MockRecoveryRunner {
  private readonly sessions = new Map<string, ExecutionSession>();
  private readonly now: () => Date;

  constructor(options: MockRecoveryRunnerOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  createSession(input: CreateSessionInput): ExecutionSession {
    if (this.sessions.has(input.sessionId)) throw new RecoveryExecutionError('Recovery session already exists');
    const timestamp = this.timestamp();
    const session = ExecutionSessionSchema.parse({
      sessionId: input.sessionId,
      mode: 'mock',
      status: 'awaiting-approval',
      commitSha: input.commitSha,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    this.sessions.set(session.sessionId, session);
    return session;
  }

  approve(sessionId: string): ExecutionSession {
    const session = this.getSession(sessionId);
    if (session.status !== 'awaiting-approval') throw new RecoveryExecutionError('Session is not awaiting approval');
    return this.save({ ...session, status: 'approved', updatedAt: this.timestamp() });
  }

  async execute(sessionId: string, scenario: MockScenario = 'success'): Promise<ExecutionResult> {
    const session = this.getSession(sessionId);
    if (session.status !== 'approved') throw new RecoveryExecutionError('Explicit approval is required before execution');

    const running = this.save({ ...session, status: 'running', updatedAt: this.timestamp() });
    const logs = ['mock runner started', `commit ${running.commitSha} pinned`, 'terraform init completed', 'terraform validate completed'];
    const createdResources: MockResource[] = [];

    if (scenario === 'plan-failure') {
      const failed = this.save({ ...running, status: 'failed', updatedAt: this.timestamp() });
      return {
        session: failed,
        logs: [...logs, 'terraform plan failed'],
        createdResources,
        failure: { code: 'PLAN_FAILED', message: 'Mock Terraform plan failed' },
      };
    }

    logs.push('terraform plan completed');
    if (scenario === 'apply-failure') {
      createdResources.push({ type: 'aws_vpc', id: `mock-vpc-${sessionId}` });
      const failed = this.save({ ...running, status: 'failed', updatedAt: this.timestamp() });
      return {
        session: failed,
        logs: [...logs, 'terraform apply failed after partial creation'],
        createdResources,
        failure: { code: 'APPLY_FAILED', message: 'Mock Terraform apply failed after partial creation' },
      };
    }

    createdResources.push(
      { type: 'aws_vpc', id: `mock-vpc-${sessionId}` },
      { type: 'aws_subnet', id: `mock-subnet-${sessionId}` },
    );
    const verifying = this.save({ ...running, status: 'verifying', updatedAt: this.timestamp() });
    return {
      session: verifying,
      logs: [...logs, 'terraform apply completed', 'execution evidence captured', 'ready for verification'],
      createdResources,
    };
  }

  async cleanup(sessionId: string, scenario: CleanupScenario = 'success'): Promise<ExecutionResult> {
    const session = this.getSession(sessionId);
    if (!['verifying', 'completed', 'failed'].includes(session.status)) {
      throw new RecoveryExecutionError('Session is not ready for cleanup');
    }
    const pending = this.save({ ...session, status: 'cleanup-pending', updatedAt: this.timestamp() });
    if (scenario === 'cleanup-failure') {
      const failed = this.save({ ...pending, status: 'cleanup-failed', updatedAt: this.timestamp() });
      return {
        session: failed,
        logs: ['cleanup started', 'cleanup failed; resources require operator attention'],
        createdResources: [],
        failure: { code: 'CLEANUP_FAILED', message: 'Mock cleanup failed' },
      };
    }
    const cleaned = this.save({ ...pending, status: 'cleaned', updatedAt: this.timestamp() });
    return {
      session: cleaned,
      logs: ['cleanup started', 'cleanup completed'],
      createdResources: [],
    };
  }

  getSession(sessionId: string): ExecutionSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new RecoveryExecutionError(`Recovery session ${sessionId} was not found`);
    return session;
  }

  private save(session: ExecutionSession): ExecutionSession {
    const parsed = ExecutionSessionSchema.parse(session);
    this.sessions.set(parsed.sessionId, parsed);
    return parsed;
  }

  private timestamp(): string {
    return this.now().toISOString();
  }
}
