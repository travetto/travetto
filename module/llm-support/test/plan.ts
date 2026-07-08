import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { buildPlans } from '../src/plan.ts';

@Suite()
class LlmSupportPlanTest {
  @Test()
  async buildsEmailPlans() {
    const output = await buildPlans({ categories: ['email'] });

    assert(output.plans.length > 0);
    assert(output.plans.every(item => item.operationId.startsWith('email-')));
    assert(output.snippets.some(item => item.capabilityTags.includes('email')));
  }

  @Test()
  async filtersPlanByOperationId() {
    const output = await buildPlans({ operations: ['create-web-route'] });

    assert(output.plans.length === 1);
    assert(output.plans[0].operationId === 'create-web-route');
    assert(output.plans[0].changes.length >= 3);
    assert(output.plans[0].changes.some(item => item.stepId === 'validate-assumptions'));
    assert(output.plans[0].changes.some(item => item.stepId === 'generate-artifacts'));
    assert(output.plans[0].changes.some(item => item.stepId === 'verify-output'));
  }

  @Test()
  async excludesScopedOperationsByDefault() {
    const output = await buildPlans();

    assert(!output.plans.some(item => item.operationId === 'excluded-eslint-profile'));
  }

  @Test()
  async includesScopedOperationsWhenRequested() {
    const output = await buildPlans({ includeExcluded: true, operations: ['excluded-eslint-profile'] });

    assert(output.plans.length === 1);
    assert(output.plans[0].operationId === 'excluded-eslint-profile');
  }
}
