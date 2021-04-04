import * as enquirer from 'enquirer';

import { EnvUtil, ExecUtil } from '@travetto/boot/src';
import { BasePlugin } from '@travetto/cli/src/plugin-base';

import { Context } from './lib/context';
import { Feature, FEATURES } from './lib/features';

/**
 * Plugin to run scaffolding
 */
export class ScaffoldPlugin extends BasePlugin {
  name = 'scaffold';

  getOptions() {
    return {
      template: this.option({ def: 'todo', desc: 'Template' }),
      dir: this.option({ desc: 'Target Directory' })
    };
  }

  getArgs() {
    return '[name]';
  }

  async #getName(name?: string) {
    if (!name) {
      const res = await enquirer.prompt<{ name: string }>([
        {
          type: 'input',
          name: 'name',
          message: 'Enter a name for application: '
        }
      ]);
      name = res.name;
    }
    return name;
  }

  async #chooseFeature(feature: Feature): Promise<Feature | undefined> {
    const res = await enquirer.prompt<{ choice: string }>({
      type: 'select' as const,
      name: 'choice',
      message: 'Please select one',
      initial: feature.default,
      choices: feature.choices!.map(x => x.title),
    } as any);

    return feature.choices?.find(x => x.title === res.choice);
  }

  async * #resolveFeatures(features: Feature[], chosen = false): AsyncGenerator<Feature> {
    for (const feat of features) {
      if (!chosen) {
        const ans = await enquirer.prompt<{ choice: boolean | string }>([{
          type: 'confirm',
          name: 'choice',
          message: `Include ${feat.title} support?`,
          initial: true
        }]);

        if (ans.choice === 'No' || ans.choice === false) {
          continue;
        }
      }

      if (feat.choices) {
        const choice = await this.#chooseFeature(feat);
        if (choice) {
          yield* this.#resolveFeatures([choice], true);
        } else {
          console.error('Invalid choice', feat);
          process.exit(1);
        }
      }

      yield feat;
    }
  }

  async action(name?: string) {
    try {
      name = await this.#getName(name);
    } catch (err) {
      console.error('Failed to provide correct input', err.message);
      process.exit(1);
    }

    const ctx = new Context(
      name, this.cmd.template, this.cmd.dir ?? name
    );

    if (!EnvUtil.isFalse('TRV_GEN_VERIFY')) {
      await ctx.initialize();
    }

    try {
      for await (const dep of this.#resolveFeatures(FEATURES)) {
        await ctx.addDependency(dep);
      }
    } catch (err) {
      console.error('Failed to provide correct input', err.message);
      process.exit(1);
    }

    await ctx.templateResolvedFiles();

    // Trigger install
    await ExecUtil.spawn('npm', ['i'], { cwd: ctx.destination(), stdio: [0, 1, 2], isolatedEnv: true }).result;
    await ExecUtil.spawn('npx', ['trv', 'build'], { cwd: ctx.destination(), stdio: [0, 1, 2], isolatedEnv: true }).result;
  }
}