import { CliCommand, CliFlag, type CliCommandShape } from '@travetto/cli';

import { recommend } from '../src/recommendation.ts';
import type { LlmOperationCategory } from '../src/types.ts';

const CATEGORIES: LlmOperationCategory[] = [
  'project',
  'web',
  'auth',
  'model',
  'upload',
  'workflow',
  'quality',
  'email',
  'test',
  'config',
  'cache'
];

/**
 * Recommend llm-support bundles, workflows, and operations.
 */
@CliCommand()
export class LlmSupportRecommendCommand implements CliCommandShape {

  @CliFlag({ short: 'b', full: 'bundles' })
  bundles?: string[];

  @CliFlag({ short: 'w', full: 'workflows' })
  workflows?: string[];

  @CliFlag({ short: 'c', full: 'categories' })
  categories?: LlmOperationCategory[];

  @CliFlag({ short: 't', full: 'snippet-tags' })
  snippetTags?: string[];

  @CliFlag({ full: 'include-excluded' })
  includeExcluded = false;

  async main(): Promise<void> {
    const categories = (this.categories ?? []).filter(item => CATEGORIES.includes(item));
    const payload = recommend({
      bundles: this.bundles,
      workflows: this.workflows,
      categories,
      snippetTags: this.snippetTags,
      includeExcluded: this.includeExcluded
    });

    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  }
}
