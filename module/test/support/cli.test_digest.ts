import { CliCommand } from '@travetto/cli';
import { Env, Runtime, describeFunction } from '@travetto/runtime';
import { Registry } from '@travetto/registry';
import { IsPrivate } from '@travetto/schema';

import { SuiteRegistryIndex } from '../src/registry/registry-index.ts';
import { RunnerUtil } from '../src/execute/util.ts';

@CliCommand()
@IsPrivate()
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
      } catch (error) {
        console.error('Failed to import', imp, error);
      }
    }

    await Registry.init();

    const suites = SuiteRegistryIndex.getClasses();
    const all = suites
      .map(c => SuiteRegistryIndex.getConfig(c))
      .filter(c => !describeFunction(c.class).abstract)
      .flatMap(c => Object.values(c.tests))
      .toSorted((a, b) => {
        const classComp = a.classId.localeCompare(b.classId);
        return classComp !== 0 ? classComp : a.methodName.localeCompare(b.methodName);
      });

    if (this.output === 'json') {
      console.log(JSON.stringify(all));
    } else {
      for (const item of all) {
        console.log(`${item.classId}#${item.methodName}`, item.tags?.join('|') ?? '');
      }
    }
  }
}