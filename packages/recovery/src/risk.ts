import type { CompleteJsonResult } from '@phoenix/ai-provider';
import { NimStructuredResponseSchema, FindingSchema, type Finding, type NimStructuredResponse } from '@phoenix/contracts';
import type { TerraformAnalysis, TerraformDependency } from '@phoenix/analyzer';

export interface RiskAiClient {
  completeJson<T>(input: {
    promptVersion: string;
    system?: string;
    user: string;
    schema: typeof NimStructuredResponseSchema;
    temperature?: number;
    maxTokens?: number;
  }): Promise<CompleteJsonResult<T>>;
}

export interface RiskAnalysisOptions {
  sessionId: string;
  observedAt: string;
  aiClient?: RiskAiClient;
}

export interface InferredAiAdvisory {
  status: 'inferred';
  data: NimStructuredResponse;
  metadata: CompleteJsonResult<NimStructuredResponse>['metadata'];
}

export interface RiskAnalysisResult {
  findings: Finding[];
  aiAdvisory?: InferredAiAdvisory;
  diagnostics: string[];
}

export async function analyzeRecoveryRisks(
  analysis: TerraformAnalysis,
  options: RiskAnalysisOptions,
): Promise<RiskAnalysisResult> {
  const findings = new Map<string, Finding>();
  const add = (finding: Finding) => {
    const parsed = FindingSchema.safeParse(finding);
    if (parsed.success) findings.set(parsed.data.id, parsed.data);
  };

  for (const unsupported of analysis.unsupported) {
    add(createFinding({
      category: 'unsupported-resource',
      severity: 'high',
      status: 'verified',
      locator: `${unsupported.path}:${unsupported.line}`,
      sessionId: options.sessionId,
      observedAt: options.observedAt,
      summary: `${unsupported.type}.${unsupported.name} is outside the supported analyzer set`,
      recommendedAction: 'Add an analyzer adapter or replace the unsupported resource before recovery.',
    }));
  }

  for (const dependency of analysis.dependencies) {
    if (dependency.kind === 'variable-reference' && !analysis.variables.includes(dependency.to.replace(/^var\./, ''))) {
      add(createFinding({
        category: 'missing-variable',
        severity: 'critical',
        status: 'verified',
        locator: `${dependency.path}:${dependency.line}`,
        sessionId: options.sessionId,
        observedAt: options.observedAt,
        summary: `Variable ${dependency.to} is referenced but not declared`,
        recommendedAction: `Declare ${dependency.to} or provide it through an approved input source.`,
      }));
      continue;
    }

    if (dependency.kind !== 'variable-reference' && !knownDependency(analysis, dependency.to)) {
      add(createFinding({
        category: 'unresolved-dependency',
        severity: 'critical',
        status: 'verified',
        locator: `${dependency.path}:${dependency.line}`,
        sessionId: options.sessionId,
        observedAt: options.observedAt,
        summary: `${dependency.from} references unresolved dependency ${dependency.to}`,
        recommendedAction: 'Resolve the dependency or declare the required external prerequisite before recovery.',
      }));
    }
  }

  for (const diagnostic of analysis.hardcodedValues) {
    add(createFinding({
      category: 'hardcoded-value',
      severity: 'medium',
      status: 'verified',
      locator: `${diagnostic.path}:${diagnostic.line}`,
      sessionId: options.sessionId,
      observedAt: options.observedAt,
      summary: diagnostic.message,
      recommendedAction: 'Move environment-specific values into validated variables or an approved external input.',
    }));
  }

  for (const diagnostic of analysis.externalPrerequisites) {
    add(createFinding({
      category: 'external-prerequisite',
      severity: 'high',
      status: 'verified',
      locator: `${diagnostic.path}:${diagnostic.line}`,
      sessionId: options.sessionId,
      observedAt: options.observedAt,
      summary: diagnostic.message,
      recommendedAction: 'Verify the external prerequisite exists and is available in the recovery target.',
    }));
  }

  const result: RiskAnalysisResult = {
    findings: [...findings.values()].sort((left, right) => left.id.localeCompare(right.id)),
    diagnostics: [],
  };

  if (!options.aiClient) return result;

  try {
    const response = await options.aiClient.completeJson<NimStructuredResponse>({
      promptVersion: 'risk-v1',
      system: 'Return JSON only. Separate verified facts from assumptions, recommendations, and missing evidence.',
      user: JSON.stringify({
        resources: analysis.resources.map(({ address, type, path, line }) => ({ address, type, path, line })),
        unsupported: analysis.unsupported,
        dependencies: analysis.dependencies,
        hardcodedValues: analysis.hardcodedValues,
        externalPrerequisites: analysis.externalPrerequisites,
        deterministicFindingIds: result.findings.map((finding) => finding.id),
      }),
      schema: NimStructuredResponseSchema,
      temperature: 0,
      maxTokens: 256,
    });
    const parsed = NimStructuredResponseSchema.parse(response.data);
    result.aiAdvisory = {
      status: 'inferred',
      data: parsed,
      metadata: response.metadata,
    };
  } catch {
    result.diagnostics.push('AI advisory unavailable');
  }

  return result;
}

function createFinding(input: {
  category: string;
  severity: Finding['severity'];
  status: Finding['status'];
  locator: string;
  sessionId: string;
  observedAt: string;
  summary: string;
  recommendedAction: string;
}): Finding {
  return {
    id: `risk-${slug(input.category)}-${slug(input.locator)}`,
    severity: input.severity,
    status: input.status,
    category: input.category,
    evidence: [{
      sourceType: 'terraform',
      locator: input.locator,
      sessionId: input.sessionId,
      observedAt: input.observedAt,
    }],
    summary: input.summary,
    recommendedAction: input.recommendedAction,
  };
}

function knownDependency(analysis: TerraformAnalysis, dependency: string): boolean {
  if (analysis.resources.some((resource) => resource.address === dependency)) return true;
  if (analysis.modules.some((module) => `module.${module}` === dependency)) return true;
  if (analysis.dataSources.some((source) => `data.${source}` === dependency)) return true;
  return false;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}
