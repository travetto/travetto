import fs from 'node:fs/promises';

import { Env, JSONUtil, RuntimeIndex } from '@travetto/runtime';
import { CliCommand, CliUtil } from '@travetto/cli';
import { IsPrivate } from '@travetto/schema';

import { runTests, selectConsumer } from './bin/run.ts';
import type { TestDiffSource } from '../src/model/test.ts';

/**  Direct test invocation */
@CliCommand()
@IsPrivate()
export class TestDiffCommand {

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
    Env.TRV_LOG_PLAIN.set(true);
    Env.TRV_LOG_TIME.clear();
  }

  async main(importOrFile: string, diff: string): Promise<void> {
    const diffSource = await fs.readFile(diff).then(JSONUtil.fromBinaryArray<TestDiffSource>);
    const importPath = RuntimeIndex.getFromImportOrSource(importOrFile)?.import!;

    return runTests(
      {
        consumer: this.format,
        consumerOptions: CliUtil.readExtendedOptions(this.formatOptions),
      },
      {
        import: importPath,
        diffSource
      }
    );
  }
}