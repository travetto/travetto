import { CliCommand, CliFlag, CliModuleFlag, type CliCommandShape } from '@travetto/cli';

import { buildPlans } from '../src/plan.ts';
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
 * Build plan-first execution details for llm-support operations.
 */
@CliCommand()
export class LlmSupportPlanCommand implements CliCommandShape {

  @CliModuleFlag(({ scope: 'command' }))
  module: string;

  @CliFlag({ short: 'o', full: 'operations' })
  operations?: string[];

  @CliFlag({ short: 'c', full: 'categories' })
  categories?: LlmOperationCategory[];

  @CliFlag({ short: 't', full: 'snippet-tags' })
  snippetTags?: string[];

  @CliFlag({ full: 'include-excluded' })
  includeExcluded = false;

  async main(): Promise<void> {
    const categories = (this.categories ?? []).filter(item => CATEGORIES.includes(item));
    const payload = await buildPlans({
      operations: this.operations,
      categories,
      snippetTags: this.snippetTags,
      includeExcluded: this.includeExcluded
    });

    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  }
}
