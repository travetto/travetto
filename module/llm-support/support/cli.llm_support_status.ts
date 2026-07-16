import { CliCommand, CliFlag } from '@travetto/cli';

import { getUnimplementedOperations } from '../src/execute.ts';
import { recommendOperations } from '../src/recommendation.ts';
import { LlmSupportScopedCommandBase } from './base-command.ts';

/**
 * Show llm-support execution coverage status.
 */
@CliCommand()
export class LlmSupportStatusCommand extends LlmSupportScopedCommandBase {

  @CliFlag({ short: 'o', full: 'operations' })
  operations?: string[];

  async main(): Promise<void> {
    const categories = this.getScopedCategories();

    const operations = this.operations ?? [];
    const selected = operations.length > 0 ?
      operations :
      recommendOperations({ categories, includeExcluded: this.includeExcluded }).map(item => item.id);

    const unimplemented = getUnimplementedOperations(selected);
    const unimplementedSet = new Set(unimplemented);
    const implemented = selected.filter(item => !unimplementedSet.has(item));

    await this.writeOutput({ implemented, unimplemented }, this.includeExcluded);
  }
}
