import { CliCommand, CliFlag } from '@travetto/cli';
import { MinLength, Required } from '@travetto/schema';

import { buildPlans } from '../src/plan.ts';
import { LlmSupportScopedSnippetCommandBase } from './base-command.ts';

/**
 * Build plan-first execution details for llm-support operations.
 */
@CliCommand()
export class LlmSupportPlanCommand extends LlmSupportScopedSnippetCommandBase {
  @CliFlag({ short: 'o', full: 'operations' })
  @Required(false)
  @MinLength(1)
  operations?: string[];

  async main(): Promise<void> {
    const categories = this.getScopedCategories();

    const payload = await buildPlans({
      operations: this.operations?.filter(Boolean) ?? [],
      categories,
      snippetTags: this.snippetTags?.filter(Boolean) ?? [],
      includeExcluded: this.includeExcluded,
    });

    await this.writeOutput(payload, this.includeExcluded);
  }
}
