import { CliCommand, CliFlag } from '@travetto/cli';
import { Required } from '@travetto/schema';

import { recommend } from '../src/recommendation.ts';
import { LlmSupportScopedSnippetCommandBase } from './base-command.ts';

/**
 * Recommend llm-support bundles, workflows, and operations.
 */
@CliCommand()
export class LlmSupportRecommendCommand extends LlmSupportScopedSnippetCommandBase {

  @CliFlag({ short: 'b', full: 'bundles' })
  @Required(false)
  bundles?: string[];

  @CliFlag({ short: 'w', full: 'workflows' })
  @Required(false)
  workflows?: string[];

  async main(): Promise<void> {
    const categories = this.getScopedCategories();

    const payload = await recommend({
      bundles: this.bundles ?? [],
      workflows: this.workflows ?? [],
      categories,
      snippetTags: this.snippetTags ?? [],
      includeExcluded: this.includeExcluded
    });

    await this.writeOutput(payload, this.includeExcluded);
  }
}
