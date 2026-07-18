import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { Class } from '@travetto/runtime';
import { SchemaValidator } from '@travetto/schema';
import { Suite, Test } from '@travetto/test';

import { ExecutionResponseSchema, PlanResponseSchema, RecommendationResponseSchema } from '../src/types.ts';
import { getLlmSupportToolDefinitions, runLlmSupportFlow, runLlmSupportTool } from '../src/tooling.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function bindAndValidate<T extends object>(schema: Class<T>, value: unknown): Promise<T> {
  const bound = schema.from({});
  Object.assign(bound, isRecord(value) ? value : {});
  await SchemaValidator.validate(schema, bound);
  return bound;
}

@Suite()
class LlmSupportToolingTest {
  @Test()
  async exposesExpectedToolDefinitions() {
    const defs = getLlmSupportToolDefinitions();
    const names = defs.map(item => item.name);

    assert(names.includes('llm_support_recommend'));
    assert(names.includes('llm_support_plan'));
    assert(names.includes('llm_support_execute'));
  }

  @Test()
  async supportsRecommendToolInvocation() {
    const output = await runLlmSupportTool('llm_support_recommend', { categories: ['web'] });

    const bound = await bindAndValidate(RecommendationResponseSchema, output);
    assert(bound.operations.length > 0);
  }

  @Test()
  async supportsPlanToolInvocation() {
    const output = await runLlmSupportTool('llm_support_plan', { operations: ['create-web-route'] });

    const bound = await bindAndValidate(PlanResponseSchema, output);
    assert(bound.plans.length === 1);
    assert(bound.plans[0].operationId === 'create-web-route');
  }

  @Test()
  async defaultsExecuteToolToDryRun() {
    const target = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-support-tooling-dry-run-'));

    const output = await runLlmSupportTool('llm_support_execute', {
      operations: ['project-bootstrap'],
      targetDir: target
    });

    const bound = await bindAndValidate(ExecutionResponseSchema, output);
    assert(bound.dryRun === true);
    assert(bound.artifacts.some(item => item.status === 'planned'));

    await assert.rejects(() => fs.access(path.join(target, 'package.json')), /ENOENT/);
  }

  @Test()
  async executesWritesWhenApplyIsTrue() {
    const target = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-support-tooling-apply-'));

    const output = await runLlmSupportTool('llm_support_execute', {
      operations: ['project-bootstrap'],
      targetDir: target,
      apply: true,
      projectName: 'tooling-app'
    });

    const bound = await bindAndValidate(ExecutionResponseSchema, output);
    assert(bound.dryRun === false);
    assert(bound.artifacts.some(item => item.status === 'created'));

    await fs.access(path.join(target, 'package.json'));
  }

  @Test()
  async skipsExistingFilesWhenOverwriteIsFalse() {
    const target = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-support-tooling-overwrite-'));

    await runLlmSupportTool('llm_support_execute', {
      operations: ['project-bootstrap'],
      targetDir: target,
      apply: true,
      projectName: 'overwrite-app'
    });

    const output = await runLlmSupportTool('llm_support_execute', {
      operations: ['project-bootstrap'],
      targetDir: target,
      apply: true,
      projectName: 'overwrite-app'
    });

    const bound = await bindAndValidate(ExecutionResponseSchema, output);
    assert(bound.dryRun === false);
    assert(bound.artifacts.some(item => item.status === 'skipped'));
    assert(bound.artifacts.some(item => item.reason === 'File already exists. Use --overwrite to replace.'));
  }

  @Test()
  async supportsMonorepoWorkspaceBootstrap() {
    const target = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-support-tooling-monorepo-'));

    const output = await runLlmSupportTool('llm_support_execute', {
      operations: ['project-bootstrap'],
      targetDir: target,
      apply: true,
      monorepo: true,
      workspacePath: '/packages/api service/',
      workspaceName: 'Demo API',
      projectName: 'Demo Root'
    });

    const bound = await bindAndValidate(ExecutionResponseSchema, output);
    assert(bound.dryRun === false);
    assert(bound.artifacts.some(item => item.status === 'created'));

    await fs.access(path.join(target, 'package.json'));
    await fs.access(path.join(target, 'packages/api-service/package.json'));
    await fs.access(path.join(target, 'packages/api-service/resources/application.yml'));
    await fs.access(path.join(target, 'packages/api-service/src/service/home.ts'));
    await fs.access(path.join(target, 'packages/api-service/src/web/home.ts'));
  }

  @Test()
  async rejectsExecuteWhenOperationsTypeIsInvalid() {
    await assert.rejects(
      () =>
        runLlmSupportTool('llm_support_execute', {
          operations: 5,
          targetDir: '.'
        }),
      /validation errors/i
    );
  }

  @Test()
  async supportsRecommendPlanExecuteFlowHelper() {
    const target = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-support-tooling-flow-'));

    const output = await runLlmSupportFlow({
      query: { operations: ['create-web-route'] },
      execute: {
        targetDir: target,
        dryRun: true
      }
    });

    assert(output.recommendation.operations.some(item => item.id === 'create-web-route'));
    assert(output.plan.plans.some(item => item.operationId === 'create-web-route'));
    assert(output.execution.dryRun === true);
    assert(output.execution.artifacts.some(item => item.stepId === 'generate-artifacts'));
  }
}
