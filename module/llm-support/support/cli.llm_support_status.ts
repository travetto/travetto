import { CliCommand, CliFlag, type CliCommandShape } from '@travetto/cli';

import { getUnimplementedOperations } from '../src/execute.ts';
import { recommendOperations } from '../src/recommendation.ts';
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
 * Show llm-support execution coverage status.
 */
@CliCommand()
export class LlmSupportStatusCommand implements CliCommandShape {

  @CliFlag({ short: 'o', full: 'operations' })
  operations?: string[];

  @CliFlag({ short: 'c', full: 'categories' })
  categories?: LlmOperationCategory[];

  @CliFlag({ full: 'include-excluded' })
  includeExcluded = false;

  async main(): Promise<void> {
    const categories = (this.categories ?? []).filter(item => CATEGORIES.includes(item));
    const selected = this.operations && this.operations.length > 0 ?
      this.operations :
      recommendOperations({ categories, includeExcluded: this.includeExcluded }).map(item => item.id);

    const unimplemented = getUnimplementedOperations(selected);
    const unimplementedSet = new Set(unimplemented);
    const implemented = selected.filter(item => !unimplementedSet.has(item));

    process.stdout.write(`${JSON.stringify({ implemented, unimplemented }, null, 2)}\n`);
  }
}
