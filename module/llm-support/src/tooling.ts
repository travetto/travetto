import type { Class } from '@travetto/runtime';
import { SchemaValidator } from '@travetto/schema';

import { executeOperations } from './execute.ts';
import { buildPlans } from './plan.ts';
import { recommend } from './recommendation.ts';
import {
  type ExecutionRequest,
  type ExecutionResponse,
  ExecutionResponseSchema,
  LlmSupportExecuteToolInput,
  LlmSupportPlanToolInput,
  LlmSupportRecommendToolInput,
  type PlanResponse,
  PlanResponseSchema,
  type RecommendationQuery,
  type RecommendationResponse,
  RecommendationResponseSchema,
} from './types.ts';

export type LlmSupportToolName = 'llm_support_recommend' | 'llm_support_plan' | 'llm_support_execute';

export interface LlmSupportToolDefinition {
  name: LlmSupportToolName;
  description: string;
  inputSchema: object;
}

export interface LlmSupportFlowInput {
  query?: RecommendationQuery;
  execute?: Omit<ExecutionRequest, 'operations'> & { operations?: string[] };
}

export interface LlmSupportFlowResult {
  recommendation: RecommendationResponse;
  plan: PlanResponse;
  execution: ExecutionResponse;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toList(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string');
  }
  if (typeof value === 'string') {
    return [value];
  }
  return undefined;
}

function normalizeQuery(input: RecommendationQuery): RecommendationQuery {
  return {
    ...input,
    bundles: toList(input.bundles) ?? input.bundles,
    workflows: toList(input.workflows) ?? input.workflows,
    operations: toList(input.operations) ?? input.operations,
    snippetTags: toList(input.snippetTags) ?? input.snippetTags,
  };
}

async function validateInput<T extends object>(schema: Class<T>, payload: unknown): Promise<T> {
  const bound = schema.from({});
  Object.assign(bound, isRecord(payload) ? payload : {});
  await SchemaValidator.validate(schema, bound);
  return bound;
}

async function validateOutput<T extends object>(schema: Class<T>, payload: unknown): Promise<T> {
  const bound = schema.from({});
  Object.assign(bound, isRecord(payload) ? payload : {});
  await SchemaValidator.validate(schema, bound);
  return bound;
}

export function getLlmSupportToolDefinitions(): LlmSupportToolDefinition[] {
  return [
    {
      name: 'llm_support_recommend',
      description: 'Recommend bundles, workflows, operations, and snippets for Travetto implementation goals.',
      inputSchema: {
        type: 'object',
        properties: {
          bundles: { type: 'array', items: { type: 'string' } },
          workflows: { type: 'array', items: { type: 'string' } },
          operations: { type: 'array', items: { type: 'string' } },
          categories: { type: 'array', items: { type: 'string' } },
          snippetTags: { type: 'array', items: { type: 'string' } },
          includeExcluded: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'llm_support_plan',
      description: 'Build file-level plans for selected operations with rationale and snippets.',
      inputSchema: {
        type: 'object',
        properties: {
          operations: { type: 'array', items: { type: 'string' } },
          categories: { type: 'array', items: { type: 'string' } },
          snippetTags: { type: 'array', items: { type: 'string' } },
          includeExcluded: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'llm_support_execute',
      description: 'Execute selected operations against a target directory. Dry-run is the default unless apply is true.',
      inputSchema: {
        type: 'object',
        required: ['operations', 'targetDir'],
        properties: {
          operations: { type: 'array', items: { type: 'string' }, minItems: 1 },
          targetDir: { type: 'string', minLength: 1 },
          apply: { type: 'boolean' },
          overwrite: { type: 'boolean' },
          monorepo: { type: 'boolean' },
          workspacePath: { type: 'string' },
          workspaceName: { type: 'string' },
          routePath: { type: 'string' },
          controllerName: { type: 'string' },
          serviceName: { type: 'string' },
          modelName: { type: 'string' },
          projectName: { type: 'string' },
          emailName: { type: 'string' },
          sendRoutePath: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  ];
}

export async function runLlmSupportTool(name: LlmSupportToolName, payload: unknown): Promise<RecommendationResponse | PlanResponse | ExecutionResponse> {
  switch (name) {
    case 'llm_support_recommend': {
      const input = await validateInput(LlmSupportRecommendToolInput, payload);
      const output = await recommend(normalizeQuery(input));
      return validateOutput(RecommendationResponseSchema, output);
    }
    case 'llm_support_plan': {
      const input = await validateInput(LlmSupportPlanToolInput, payload);
      const output = await buildPlans(normalizeQuery(input));
      return validateOutput(PlanResponseSchema, output);
    }
    case 'llm_support_execute': {
      const input = await validateInput(LlmSupportExecuteToolInput, payload);
      const request: ExecutionRequest = {
        operations: toList(input.operations) ?? [],
        targetDir: input.targetDir,
        dryRun: input.apply !== true,
        overwrite: input.overwrite,
        monorepo: input.monorepo,
        workspacePath: input.workspacePath,
        workspaceName: input.workspaceName,
        routePath: input.routePath,
        controllerName: input.controllerName,
        serviceName: input.serviceName,
        modelName: input.modelName,
        projectName: input.projectName,
        emailName: input.emailName,
        sendRoutePath: input.sendRoutePath,
      };
      const output = await executeOperations(request);
      return validateOutput(ExecutionResponseSchema, output);
    }
  }
}

export async function runLlmSupportFlow(input: LlmSupportFlowInput = {}): Promise<LlmSupportFlowResult> {
  const query = normalizeQuery(input.query ?? {});
  const recommendation = await validateOutput(RecommendationResponseSchema, await recommend(query));
  const plan = await validateOutput(PlanResponseSchema, await buildPlans(query));

  const execute = input.execute ?? { targetDir: '.', dryRun: true };
  const operations = toList(execute.operations) ?? plan.plans.map(item => item.operationId);

  const executionRequest: ExecutionRequest = {
    ...execute,
    operations,
    targetDir: execute.targetDir,
  };
  const execution = await validateOutput(ExecutionResponseSchema, await executeOperations(executionRequest));

  return {
    recommendation,
    plan,
    execution,
  };
}
