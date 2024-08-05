import { CliCommand } from '@travetto/cli';
import { Env, Runtime, describeFunction } from '@travetto/runtime';

import { SuiteRegistry } from '../src/registry/suite';
import { RunnerUtil } from '../src/execute/util';

@CliCommand({ hidden: true })
export class TestCountCommand {

  preMain(): void {
    Env.TRV_ROLE.set('test');
    Env.DEBUG.set(false);
  }

  async main(patterns: string[]) {
    const imports = await RunnerUtil.getTestImports(patterns);

    // Load all tests
    for (const imp of imports) {
      try {
        await Runtime.import(imp);
      } catch (err) {
        console.error('Failed to import', imp, err);
      }
    }

    await SuiteRegistry.init();

    const suites = SuiteRegistry.getClasses();
    const total = suites
      .map(c => SuiteRegistry.get(c))
      .filter(c => !describeFunction(c.class).abstract)
      .reduce((acc, c) => acc + (c.tests?.length ?? 0), 0);

    console.log(total);
  }
}