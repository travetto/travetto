import { CliCommand } from '@travetto/cli';
import { Env, Runtime, describeFunction } from '@travetto/runtime';
import { RegistryV2 } from '@travetto/registry';

import { SuiteRegistryIndex } from '../src/registry/registry-index.ts';
import { RunnerUtil } from '../src/execute/util.ts';

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

    await RegistryV2.init();

    const suites = RegistryV2.getClasses(SuiteRegistryIndex);
    const all = suites
      .map(c => SuiteRegistryIndex.getSuiteConfig(c))
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