import { Env } from '@travetto/runtime';
import { CliCommand } from '@travetto/cli';

import { runTests, selectConsumer } from './bin/run';

/**  Direct test invocation */
@CliCommand({ hidden: true })
export class TestDirectCommand {

  format: string = 'tap';

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
    return runTests({
      consumer: this.format,
      target: {
        import: importOrFile,
        classId: clsId,
        methodNames: methodsNames,
      }
    });
  }
}