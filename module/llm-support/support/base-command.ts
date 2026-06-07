import { CliFlag, CliModuleFlag, type CliCommandShape } from '@travetto/cli';
import { Required } from '@travetto/schema';
import { JSONUtil } from '@travetto/runtime';

import { getValidOperationIds, LLM_OPERATION_CATEGORIES } from '../src/recommendation.ts';
import { getValidSnippetTags } from '../src/snippet-catalog.ts';
import type { LlmOperationCategory } from '../src/types.ts';

interface LlmSupportValidValues {
  categories: readonly LlmOperationCategory[];
  operations: string[];
  snippetTags: string[];
}

export abstract class LlmSupportCommandBase implements CliCommandShape {

  @CliModuleFlag(({ scope: 'command' }))
  module: string = '';

  async getValidValues(includeExcluded: boolean): Promise<LlmSupportValidValues> {
    return {
      categories: LLM_OPERATION_CATEGORIES,
      operations: getValidOperationIds(includeExcluded),
      snippetTags: await getValidSnippetTags()
    };
  }

  async writeOutput(payload: object, includeExcluded: boolean): Promise<void> {
    const valid = await this.getValidValues(includeExcluded);
    process.stdout.write(`${JSONUtil.toUTF8({ ...payload, valid }, { indent: 2 })}\n`);
  }

  abstract main(): Promise<void>;
}

export abstract class LlmSupportScopedCommandBase extends LlmSupportCommandBase {

  @CliFlag({ short: 'c', full: 'categories' })
  @Required(false)
  categories?: LlmOperationCategory[];

  @CliFlag({ full: 'include-excluded' })
  includeExcluded = false;

  getScopedCategories(): LlmOperationCategory[] {
    return this.categories?.filter(item =>
      LLM_OPERATION_CATEGORIES.some(allowed => allowed === item)
    ) ?? [];
  }
}

export abstract class LlmSupportScopedSnippetCommandBase extends LlmSupportScopedCommandBase {

  @CliFlag({ short: 't', full: 'snippet-tags' })
  @Required(false)
  snippetTags?: string[];
}
