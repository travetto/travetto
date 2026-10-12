import { CliCommand } from '@travetto/cli';
import { Registry } from '@travetto/registry';
import { describeFunction, Env, JSONUtil, Runtime } from '@travetto/runtime';
import { IsPrivate } from '@travetto/schema';

import { RunUtil } from '../src/execute/run.ts';
import { SuiteRegistryIndex } from '../src/registry/registry-index.ts';

@CliCommand({ supportDebug: false })
@IsPrivate()
/**
 * Produce a deterministic digest of discovered test identifiers.
 *
 * This is an internal command used by tooling to enumerate tests in a stable
 * order for planning, sharding, or change detection workflows.
 */
export class TestDigestCommand {
  /** Output mode for digest emission. */
  output: 'json' | 'text' = 'text';

  async main(globs: string[] = ['**/*']) {
    Env.TRV_ROLE.set('test');

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
