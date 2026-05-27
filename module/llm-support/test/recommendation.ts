import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { getUnimplementedOperations } from '../src/execute.ts';
import { LLM_SNIPPET_SOURCES } from '../src/snippet-catalog.ts';
import { WORKFLOWS } from '../src/workflow-guidance.ts';
import {
  EXCLUDED_OPERATION_IDS,
  getValidOperationIds,
  recommend,
  recommendOperations
} from '../src/recommendation.ts';

@Suite()
class LlmSupportRecommendationTest {

  @Test()
  async excludesScopedOperationsByDefault() {
    const output = recommendOperations();
    const ids = new Set(output.map(item => item.id));

    for (const excludedId of EXCLUDED_OPERATION_IDS) {
      assert(!ids.has(excludedId));
    }
  }

  @Test()
  async includesScopedOperationsWhenRequested() {
    const output = (await recommend({ includeExcluded: true })).operations;
    const ids = new Set(output.map(item => item.id));

    for (const excludedId of EXCLUDED_OPERATION_IDS) {
      assert(ids.has(excludedId));
    }
  }

  @Test()
  async supportsCategoryFiltering() {
    const output = await recommend({ categories: ['email'] });

    assert(output.operations.length > 0);
    for (const op of output.operations) {
      assert(op.category === 'email');
    }
  }

  @Test()
  async returnsSnippetsForSelectedOperations() {
    const output = await recommend({ categories: ['email'] });

    assert(output.snippets.length > 0);
    assert(output.snippets.some(item => item.capabilityTags.includes('email')));
  }

  @Test()
  async filtersSnippetsByTag() {
    const output = await recommend({ snippetTags: ['cloudfront'] });

    assert(output.snippets.length > 0);
    assert(output.snippets.every(item => item.capabilityTags.includes('cloudfront')));
  }

  @Test()
  async snippetOperationIdsStayInSyncWithOperations() {
    const snippets = await LLM_SNIPPET_SOURCES;
    const validIds = new Set(getValidOperationIds(true));

    for (const snippet of snippets) {
      for (const operationId of snippet.operationIds ?? []) {
        assert(validIds.has(operationId), `Unknown operation id '${operationId}' in snippet '${snippet.sourceId}'`);
      }
    }
  }

  @Test()
  async workflowGuidanceStaysWellFormed() {
    const ids = new Set<string>();

    for (const workflow of WORKFLOWS) {
      assert(workflow.id.length > 0);
      assert(!ids.has(workflow.id), `Duplicate workflow id '${workflow.id}'`);
      ids.add(workflow.id);
      assert(workflow.commandDiscoveryRule.includes('cli:schema'));
      assert(workflow.recommendedModules.length > 0);
    }
  }

  @Test()
  async operationMetadataStaysWellFormed() {
    const ops = recommendOperations({ includeExcluded: true });
    const ids = new Set<string>();
    const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

    for (const op of ops) {
      assert(op.id.length > 0);
      assert(idPattern.test(op.id), `Operation id should be kebab-case: '${op.id}'`);
      assert(!ids.has(op.id), `Duplicate operation id '${op.id}'`);
      ids.add(op.id);

      assert(op.title.length > 0, `Operation '${op.id}' is missing title`);
      assert(op.summary.length > 0, `Operation '${op.id}' is missing summary`);

      const moduleNames = [...op.requiredModules, ...op.optionalModules];
      const duplicateModules = moduleNames.filter((item, idx, arr) => arr.indexOf(item) !== idx);
      assert(duplicateModules.length === 0, `Operation '${op.id}' has duplicate modules`);
      assert(op.requiredModules.every(item => item.startsWith('@travetto/')), `Operation '${op.id}' has non-travetto required module`);
      assert(op.optionalModules.every(item => item.startsWith('@travetto/')), `Operation '${op.id}' has non-travetto optional module`);
    }
  }

  @Test()
  async nonExcludedOperationsStayExecutable() {
    const ids = recommendOperations({ includeExcluded: false }).map(item => item.id);
    const missing = getUnimplementedOperations(ids);

    assert(missing.length === 0, `Missing executors for operations: ${missing.join(', ')}`);
  }
}
