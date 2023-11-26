import { CliCommand } from '@travetto/cli';
import { RootIndex } from '@travetto/manifest';
import { defineEnv } from '@travetto/base';

import { SuiteRegistry } from '../src/registry/suite';
import { RunnerUtil } from '../src/execute/util';

@CliCommand({ hidden: true })
export class TestCountCommand {

  preMain(): void {
    defineEnv({ debug: false, envName: 'test' });
  }

  async main(patterns: string[]) {
    const regexes = patterns.map(x => new RegExp(x));
    const files = await RunnerUtil.getTestFiles(regexes);

    // Load all tests
    for (const file of files) {
      try {
        await import(file.import);
      } catch (err) {
        console.error('Failed to import', file.sourceFile, err);
      }
    }

    await SuiteRegistry.init();

    const suites = SuiteRegistry.getClasses();
    const total = suites
      .map(c => SuiteRegistry.get(c))
      .filter(c => !RootIndex.getFunctionMetadata(c.class)?.abstract)
      .reduce((acc, c) => acc + (c.tests?.length ?? 0), 0);

    console.log(total);
  }
}