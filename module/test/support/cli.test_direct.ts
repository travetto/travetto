import { Env } from '@travetto/runtime';
import { CliCommand } from '@travetto/cli';

import { runTests } from './bin/run';
import { TestFormat } from './bin/types';

/**  Direct test invocation */
@CliCommand({ hidden: true })
export class TestDirectCommand {

  format: TestFormat = 'tap';

  preMain(): void {
    Env.TRV_ROLE.set('test');
    Env.TRV_ENV.set('test');
    Env.TRV_LOG_PLAIN.set(true);
    Env.TRV_LOG_TIME.clear();
  }

  main(file: string, args: string[]): Promise<void> {
    return runTests({ args: [file, ...args], format: this.format, mode: 'single', concurrency: 1 });
  }
}