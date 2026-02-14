import { CliCommand } from '@travetto/cli';
import { JSONUtil, Env, Runtime, describeFunction } from '@travetto/runtime';
import { Registry } from '@travetto/registry';
import { IsPrivate } from '@travetto/schema';

import { SuiteRegistryIndex } from '../src/registry/registry-index.ts';
import { RunUtil } from '../src/execute/run.ts';

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
    for await (const imp of RunUtil.getTestImports(globs)) {
      try {
        await Runtime.importFrom(imp);
      } catch (error) {
        console.error('Failed to import', imp, error);
      }
    }

    await Registry.init();

    const suites = SuiteRegistryIndex.getClasses();
    const all = suites
      .map(cls => SuiteRegistryIndex.getConfig(cls))
      .filter(config => !describeFunction(config.class).abstract)
      .flatMap(config => Object.values(config.tests))
      .toSorted((a, b) => {
        const classComp = a.classId.localeCompare(b.classId);
        return classComp !== 0 ? classComp : a.methodName.localeCompare(b.methodName);
      });

    if (this.output === 'json') {
      console.log(JSONUtil.toUTF8(all));
    } else {
      for (const item of all) {
        console.log(`${item.classId}#${item.methodName}`, item.tags?.join('|') ?? '');
      }
    }
  }
}