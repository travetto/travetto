import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import {
  RECOMMENDATION_SCHEMA_VERSION,
  resolveRecommendation,
  resolveRecommendationJsonV1
} from '../src/recommendation.ts';

@Suite()
export class LlmSupportRecommendationContractTest {

  @Test('strict json output has stable schema fields')
  async jsonSchemaContract() {
    const output = resolveRecommendationJsonV1({ workflow: 'build-api-service' });

    assert(output.schemaVersion === RECOMMENDATION_SCHEMA_VERSION);
    assert(output.data.workflows.length === 1);
    assert(output.data.workflows[0].id === 'build-api-service');
    assert(output.data.required.includes('@travetto/web'));
    assert(output.data.required.includes('@travetto/runtime'));
    assert(Array.isArray(output.data.commandDiscoveryRules));
    assert(output.data.commandDiscoveryRules.length >= 1);
    assert(Array.isArray(output.data.verification));
    assert(output.data.verification.length >= 1);
  }

  @Test('required and optional sets do not overlap')
  async requiredOptionalDisjoint() {
    const output = resolveRecommendation({ intent: 'persistence' });
    const required = new Set(output.required);

    assert(output.workflows.some(workflow => workflow.id === 'enable-persistence'));
    assert(output.optional.every(pkg => !required.has(pkg)));
  }

  @Test('non-sql workflow narrows adapters by needs')
  async nonSqlNeedsSelection() {
    const output = resolveRecommendation({
      workflow: 'enable-persistence',
      needs: ['blob', 'query', 'indexed']
    });

    assert(output.selectedNeeds.length === 3);
    assert(output.selectedNeeds.includes('blob'));
    assert(output.selectedNeeds.includes('query'));
    assert(output.selectedNeeds.includes('indexed'));
    assert(output.recommendedAdapters.includes('@travetto/model-memory'));
    assert(output.recommendedAdapters.includes('@travetto/model-mongo'));
    assert(!output.recommendedAdapters.includes('@travetto/model-s3'));
  }

  @Test('google oauth workflow includes passport guidance')
  async googleOauthPassportWorkflow() {
    const output = resolveRecommendation({ workflow: 'enable-google-oauth-passport' });

    assert(output.workflows.length === 1);
    assert(output.workflows[0].id === 'enable-google-oauth-passport');
    assert(output.required.includes('@travetto/auth-web-passport'));
    assert(output.optional.includes('@travetto/model-firestore'));
    assert(output.verification.some(line => line.includes('google.auth')));
  }

  @Test('scaffold workflows are resolvable')
  async scaffoldWorkflowsResolvable() {
    const workflowIds = [
      'scaffold-web-openapi-service',
      'scaffold-auth-basic-session',
      'scaffold-web-model-crud',
      'scaffold-model-backend-selection',
      'scaffold-quality-setup'
    ];

    for (const workflowId of workflowIds) {
      const output = resolveRecommendation({ workflow: workflowId });
      assert(output.workflows.length === 1);
      assert(output.workflows[0].id === workflowId);
      assert(output.required.length >= 1);
      assert(output.commandDiscoveryRules.length >= 1);
      assert(output.verification.length >= 1);
    }
  }

  @Test('scaffold quality bundle includes test and eslint')
  async scaffoldQualityBundle() {
    const output = resolveRecommendation({ bundle: 'scaffold-quality-setup' });

    assert(output.bundles.length === 1);
    assert(output.bundles[0].id === 'scaffold-quality-setup');
    assert(output.required.includes('@travetto/test'));
    assert(output.required.includes('@travetto/eslint'));
  }
}
