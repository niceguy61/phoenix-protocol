import { parse } from '@cdktf/hcl2json';

export const SUPPORTED_AWS_RESOURCES = new Set([
  'aws_vpc',
  'aws_subnet',
  'aws_security_group',
  'aws_instance',
  'aws_lb',
  'aws_lb_target_group',
  'aws_ecs_cluster',
  'aws_ecs_service',
  'aws_iam_role',
  'aws_iam_policy',
  'aws_db_instance',
  'aws_s3_bucket',
  'aws_kms_key',
  'aws_secretsmanager_secret',
]);

export interface TerraformFile {
  path: string;
  content: string;
}

export interface SourceLocator {
  path: string;
  line: number;
}

export interface ResourceMetadata extends SourceLocator {
  address: string;
  type: string;
  name: string;
  attributes: Record<string, unknown>;
}

export interface UnsupportedConstruct extends SourceLocator {
  kind: 'resource' | 'data-source' | 'block';
  type: string;
  name: string;
  reason: string;
}

export interface TerraformDependency extends SourceLocator {
  from: string;
  to: string;
  kind: 'reference' | 'explicit-depends-on' | 'module-reference' | 'variable-reference';
}

export interface TerraformDiagnostic extends SourceLocator {
  severity: 'error' | 'warning';
  code: 'PARSE_ERROR' | 'UNSUPPORTED_RESOURCE' | 'HARD_CODED_VALUE' | 'EXTERNAL_PREREQUISITE';
  message: string;
}

export interface TerraformAnalysis {
  filesAnalyzed: string[];
  resources: ResourceMetadata[];
  modules: string[];
  dataSources: string[];
  variables: string[];
  outputs: string[];
  dependencies: TerraformDependency[];
  unsupported: UnsupportedConstruct[];
  hardcodedValues: TerraformDiagnostic[];
  externalPrerequisites: TerraformDiagnostic[];
  diagnostics: TerraformDiagnostic[];
}

type BlockKind = 'resource' | 'data' | 'module' | 'variable' | 'output';

interface TerraformBlock {
  kind: BlockKind;
  firstLabel: string;
  secondLabel?: string;
  body: string;
  path: string;
  line: number;
}

export async function analyzeTerraform(files: TerraformFile[]): Promise<TerraformAnalysis> {
  const result: TerraformAnalysis = {
    filesAnalyzed: [],
    resources: [],
    modules: [],
    dataSources: [],
    variables: [],
    outputs: [],
    dependencies: [],
    unsupported: [],
    hardcodedValues: [],
    externalPrerequisites: [],
    diagnostics: [],
  };

  for (const file of files) {
    if (!file.path.endsWith('.tf') && !file.path.endsWith('.tf.json')) continue;
    result.filesAnalyzed.push(file.path);

    let parsed: unknown;
    try {
      parsed = await parse(file.path, file.content);
    } catch (error) {
      result.diagnostics.push({
        path: file.path,
        line: 1,
        severity: 'error',
        code: 'PARSE_ERROR',
        message: `Terraform syntax could not be parsed: ${safeErrorMessage(error)}`,
      });
      continue;
    }

    for (const block of extractBlocks(file.path, file.content)) {
      const address = blockAddress(block);
      if (block.kind === 'resource') {
        if (!SUPPORTED_AWS_RESOURCES.has(block.firstLabel)) {
          const unsupported = {
            path: block.path,
            line: block.line,
            kind: 'resource' as const,
            type: block.firstLabel,
            name: block.secondLabel ?? 'unknown',
            reason: 'Resource type is outside the initial supported AWS resource set',
          };
          result.unsupported.push(unsupported);
          result.diagnostics.push({
            ...unsupported,
            severity: 'warning',
            code: 'UNSUPPORTED_RESOURCE',
            message: `${unsupported.type} is not supported in the initial analyzer`,
          });
          continue;
        }
        result.resources.push({
          path: block.path,
          line: block.line,
          address,
          type: block.firstLabel,
          name: block.secondLabel ?? 'unknown',
          attributes: readBlockAttributes(parsed, block),
        });
      } else if (block.kind === 'data') {
        result.dataSources.push(address.replace(/^data\./, ''));
      } else if (block.kind === 'module') {
        result.modules.push(block.firstLabel);
      } else if (block.kind === 'variable') {
        result.variables.push(block.firstLabel);
      } else if (block.kind === 'output') {
        result.outputs.push(block.firstLabel);
      }

      result.dependencies.push(...extractDependencies(block));
      result.hardcodedValues.push(...findHardcodedValues(block));
      result.externalPrerequisites.push(...findExternalPrerequisites(block));
    }
  }

  result.filesAnalyzed.sort();
  result.modules = unique(result.modules);
  result.dataSources = unique(result.dataSources);
  result.variables = unique(result.variables);
  result.outputs = unique(result.outputs);
  result.dependencies = uniqueDependencies(result.dependencies);
  result.hardcodedValues = uniqueDiagnostics(result.hardcodedValues);
  result.externalPrerequisites = uniqueDiagnostics(result.externalPrerequisites);
  return result;
}

function extractBlocks(path: string, content: string): TerraformBlock[] {
  const blocks: TerraformBlock[] = [];
  const header = /(^|\n)\s*(resource|data|module|variable|output)\s+"([^"]+)"(?:\s+"([^"]+)")?\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = header.exec(content)) !== null) {
    const openBrace = content.indexOf('{', match.index + match[0].length - 1);
    const closeBrace = findClosingBrace(content, openBrace);
    if (closeBrace === -1) {
      throw new Error(`Unclosed block near line ${lineNumber(content, match.index)}`);
    }
    blocks.push({
      kind: match[2] as BlockKind,
      firstLabel: match[3],
      secondLabel: match[4],
      body: content.slice(openBrace + 1, closeBrace),
      path,
      line: lineNumber(content, match.index),
    });
    header.lastIndex = closeBrace + 1;
  }
  return blocks;
}

function findClosingBrace(content: string, openBrace: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let inLineComment = false;

  for (let index = openBrace; index < content.length; index += 1) {
    const character = content[index];
    const next = content[index + 1];
    if (inLineComment) {
      if (character === '\n') inLineComment = false;
      continue;
    }
    if (!inString && character === '#' ) {
      inLineComment = true;
      continue;
    }
    if (character === '"' && !escaped) {
      inString = !inString;
      continue;
    }
    if (inString) {
      escaped = character === '\\' && !escaped;
      if (character !== '\\') escaped = false;
      continue;
    }
    if (character === '/' && next === '/') {
      inLineComment = true;
      index += 1;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function blockAddress(block: TerraformBlock): string {
  if (block.kind === 'resource') return `${block.firstLabel}.${block.secondLabel}`;
  if (block.kind === 'data') return `data.${block.firstLabel}.${block.secondLabel}`;
  if (block.kind === 'module') return `module.${block.firstLabel}`;
  if (block.kind === 'variable') return `var.${block.firstLabel}`;
  return `output.${block.firstLabel}`;
}

function extractDependencies(block: TerraformBlock): TerraformDependency[] {
  const dependencies: TerraformDependency[] = [];
  const from = blockAddress(block);
  const resourceReferences = /\b(aws_[A-Za-z0-9_]+)\.([A-Za-z0-9_-]+)(?:\.[A-Za-z0-9_-]+)?/g;
  let match: RegExpExecArray | null;
  while ((match = resourceReferences.exec(block.body)) !== null) {
    const to = `${match[1]}.${match[2]}`;
    if (to !== from) dependencies.push({
      from,
      to,
      kind: block.body.includes('depends_on') ? 'explicit-depends-on' : 'reference',
      path: block.path,
      line: block.line,
    });
  }

  const moduleReferences = /\bmodule\.([A-Za-z0-9_-]+)/g;
  while ((match = moduleReferences.exec(block.body)) !== null) {
    dependencies.push({
      from,
      to: `module.${match[1]}`,
      kind: 'module-reference',
      path: block.path,
      line: block.line,
    });
  }

  const variableReferences = /\bvar\.([A-Za-z0-9_-]+)/g;
  while ((match = variableReferences.exec(block.body)) !== null) {
    dependencies.push({
      from,
      to: `var.${match[1]}`,
      kind: 'variable-reference',
      path: block.path,
      line: block.line,
    });
  }
  return dependencies;
}

function findHardcodedValues(block: TerraformBlock): TerraformDiagnostic[] {
  const patterns = [
    { pattern: /\bami\s*=\s*"ami-[^"]+"/, message: 'AMI ID is hardcoded' },
    { pattern: /\bregion\s*=\s*"[^"]+"/, message: 'AWS region is hardcoded' },
    { pattern: /\baccount_id\s*=\s*"[^"]+"/, message: 'AWS account ID is hardcoded' },
  ];
  return patterns.filter(({ pattern }) => pattern.test(block.body)).map(({ message }) => ({
    path: block.path,
    line: block.line,
    severity: 'warning' as const,
    code: 'HARD_CODED_VALUE' as const,
    message: `${message} in ${blockAddress(block)}`,
  }));
}

function findExternalPrerequisites(block: TerraformBlock): TerraformDiagnostic[] {
  const patterns = [
    { pattern: /\bimage\s*=\s*"[^"$]+"/, message: 'Container image availability must be verified' },
    { pattern: /\bcertificate_arn\s*=\s*"[^"$]+"/, message: 'Certificate is externally managed' },
    { pattern: /\bdomain(name)?\s*=\s*"[^"$]+"/, message: 'DNS domain is externally managed' },
  ];
  return patterns.filter(({ pattern }) => pattern.test(block.body)).map(({ message }) => ({
    path: block.path,
    line: block.line,
    severity: 'warning' as const,
    code: 'EXTERNAL_PREREQUISITE' as const,
    message: `${message} in ${blockAddress(block)}`,
  }));
}

function readBlockAttributes(parsed: unknown, block: TerraformBlock): Record<string, unknown> {
  if (!parsed || typeof parsed !== 'object') return {};
  const root = (parsed as Record<string, unknown>)[block.kind];
  if (!root || typeof root !== 'object') return {};
  const first = (root as Record<string, unknown>)[block.firstLabel];
  if (!Array.isArray(first) || !first[0] || typeof first[0] !== 'object') return {};
  if (!block.secondLabel) return first[0] as Record<string, unknown>;
  const named = (first[0] as Record<string, unknown>)[block.secondLabel];
  return named && typeof named === 'object' ? named as Record<string, unknown> : first[0] as Record<string, unknown>;
}

function lineNumber(content: string, offset: number): number {
  return content.slice(0, offset).split('\n').length;
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown parser error';
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function uniqueDependencies(values: TerraformDependency[]): TerraformDependency[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = `${value.from}|${value.to}|${value.kind}|${value.path}|${value.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueDiagnostics(values: TerraformDiagnostic[]): TerraformDiagnostic[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = `${value.code}|${value.path}|${value.line}|${value.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export * from './graph';
