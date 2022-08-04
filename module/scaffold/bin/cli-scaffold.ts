import * as enquirer from 'enquirer';

import { PathUtil, EnvUtil } from '@travetto/boot';
import { CliCommand, OptionConfig } from '@travetto/cli/src/command';

import { Context } from './lib/context';
import { Feature, FEATURES } from './lib/features';

type Options = {
  template: OptionConfig<string>;
  dir: OptionConfig<string>;
  force: OptionConfig<boolean>;
};

/**
 * Command to run scaffolding
 */
export class ScaffoldCommand extends CliCommand<Options> {
  name = 'scaffold';

  getOptions(): Options {
    return {
      template: this.option({ def: 'todo', desc: 'Template' }),
      dir: this.option({ desc: 'Target Directory' }),
      force: this.boolOption({ desc: 'Force writing into an existing directory', def: false })
    };
  }

  getArgs(): string {
    return '[name]';
  }

  async #getName(name?: string): Promise<string> {
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
    const choice: (Parameters<typeof enquirer['prompt']>[0] & { type: 'select' }) = {
      type: 'select' as const,
      name: 'choice',
      message: 'Please select one',
      initial: feature.default,
      choices: feature.choices!.map(x => x.title).filter((x?: string): x is string => !!x),
    };

    const res = await enquirer.prompt<{ choice: string }>(choice);
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

  async action(name?: string): Promise<void> {
    try {
      name = await this.#getName(name);
    } catch (err) {
      if (err instanceof Error) {
        console.error('Failed to provide correct input', err.message);
      }
      process.exit(1);
    }

    const ctx = new Context(
      name, this.cmd.template, PathUtil.resolveUnix(EnvUtil.get('INIT_CWD', process.cwd()), this.cmd.dir ?? name)
    );

    if (!this.cmd.force) {
      await ctx.initialize();
    }

    try {
      for await (const dep of this.#resolveFeatures(FEATURES)) {
        await ctx.addDependency(dep);
      }
    } catch (err) {
      if (err instanceof Error) {
        console.error('Failed to provide correct input', err.message);
      }
      process.exit(1);
    }

    await ctx.templateResolvedFiles();

    await ctx.exec('npm', ['i']);
    await ctx.exec('npm', ['run', 'build']);
  }
}