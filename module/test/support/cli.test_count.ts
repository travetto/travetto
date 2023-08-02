import { CliCommand } from '@travetto/cli';
import { RootIndex } from '@travetto/manifest';

import { SuiteRegistry } from '../src/registry/suite';
import { RunnerUtil } from '../src/execute/util';
import { GlobalEnvConfig } from '@travetto/base';

@CliCommand({ hidden: true })
export class TestCountCommand {

  envInit(): GlobalEnvConfig {
    return { debug: false, envName: 'test' };
  }

  async main(patterns: string[]) {
    const regexes = patterns.map(x => new RegExp(x));
    const files = await RunnerUtil.getTestFiles(regexes);

    // Load all tests
    for (const file of files) {
      await import(RootIndex.getFromSource(file)!.import);
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