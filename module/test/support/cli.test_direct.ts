import { Env, RuntimeIndex } from '@travetto/runtime';
import { CliCommand, CliUtil } from '@travetto/cli';
import { IsPrivate } from '@travetto/schema';

import { runTests, selectConsumer } from './bin/run.ts';

/**  Direct test invocation */
@CliCommand()
@IsPrivate()
export class TestDirectCommand {

  format: string = 'tap';

  /**
   * Format options
   * @alias o
   */
  formatOptions?: string[];

  async preValidate(): Promise<void> {
    await selectConsumer(this);
  }

  preMain(): void {
    Env.TRV_ROLE.set('test');
    Env.TRV_ENV.set('test');
    Env.TRV_LOG_PLAIN.set(true);
    Env.TRV_LOG_TIME.clear();
    Env.TRV_CAN_RESTART.clear();
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