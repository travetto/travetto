import { Env } from '@travetto/runtime';
import { CliCommand } from '@travetto/cli';
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
  }

  main(importOrFile: string, clsId?: string, methodsNames: string[] = []): Promise<void> {

    const options = Object.fromEntries((this.formatOptions ?? [])?.map(f => [...f.split(':'), true]));

    return runTests({
      consumer: this.format,
      consumerOptions: options,
      target: {
        import: importOrFile,
        classId: clsId,
        methodNames: methodsNames,
      }
    });
  }
}