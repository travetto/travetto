import { Env, RuntimeIndex } from '@travetto/runtime';
import { CliCommand, CliUtil } from '@travetto/cli';
import { IsPrivate } from '@travetto/schema';

import { runTests } from './bin/run.ts';
import { TestFormatField } from './bin/decorator.ts';

/**  Direct test invocation */
@CliCommand()
@IsPrivate()
export class TestDirectCommand {

  @TestFormatField()
  format: string;

  /**
   * Format options
   * @alias o
   */
  formatOptions?: string[];

  preMain(): void {
    Env.TRV_ROLE.set('test');
    Env.TRV_LOG_PLAIN.set(true);
    Env.TRV_LOG_TIME.clear();
  }

  main(importOrFile: string, clsId?: string, methodsNames: string[] = []): Promise<void> {
    // Resolve to import
    const importPath = RuntimeIndex.getFromImportOrSource(importOrFile)?.import!;

    return runTests(
      {
        consumer: this.format,
        consumerOptions: CliUtil.readExtendedOptions(this.formatOptions),
      },
      {
        import: importPath,
        classId: clsId,
        methodNames: methodsNames,
      }
    );
  }
}