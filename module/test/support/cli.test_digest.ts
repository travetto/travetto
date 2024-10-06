import { CliCommand } from '@travetto/cli';
import { Env, Runtime, describeFunction } from '@travetto/runtime';

import { SuiteRegistry } from '../src/registry/suite';
import { RunnerUtil } from '../src/execute/util';

@CliCommand({ hidden: true })
export class TestDigestCommand {

  output: 'json' | 'text' = 'text';

  preMain(): void {
    Env.TRV_ROLE.set('test');
    Env.DEBUG.set(false);
  }

  async main(globs: string[] = ['**/*']) {
    // Load all tests
    for await (const imp of await RunnerUtil.getTestImports(globs)) {
      try {
        await Runtime.importFrom(imp);
      } catch (err) {
        console.error('Failed to import', imp, err);
      }
    }

    await SuiteRegistry.init();

    const suites = SuiteRegistry.getClasses();
    const all = suites
      .map(c => SuiteRegistry.get(c))
      .filter(c => !describeFunction(c.class).abstract)
      .flatMap(c => c.tests);

    if (this.output === 'json') {
      console.log(JSON.stringify(all));
    } else {
      for (const item of all) {
        console.log(`${item.classId}#${item.methodName}`, item.tags?.join('|') ?? '');
      }
    }
  }
}