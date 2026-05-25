import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { EXCLUDED_OPERATION_IDS, recommend, recommendOperations } from '../src/recommendation.ts';

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
}
