import { GlobalEnvConfig } from '@travetto/base';
import { CliCommand } from '@travetto/cli';

import { runTests } from './bin/run';
import { TestFormat } from './bin/types';

/**  Direct test invocation */
@CliCommand({ hidden: true })
export class TestDirectCommand {

  format: TestFormat = 'tap';

  envInit(): GlobalEnvConfig {
    return { test: true };
  }

  main(file: string, args: string[]): Promise<void> {
    return runTests({ args: [file, ...args], format: this.format, mode: 'single', concurrency: 1 });
  }
}