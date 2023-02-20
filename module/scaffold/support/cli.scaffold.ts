import enquirer from 'enquirer';

import { path } from '@travetto/manifest';
import { CliCommand, cliTpl, OptionConfig } from '@travetto/cli';
import { GlobalTerminal } from '@travetto/terminal';

import { Context } from './bin/context';
import { Feature, FEATURES } from './bin/features';

type Options = {
  template: OptionConfig<string>;
  cwd: OptionConfig<string>;
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
      cwd: this.option({ desc: 'Current Working Directory override' }),
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
      if (!chosen && !feat.required) {
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
          throw new Error(`Invalid choice: ${feat}`);
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
      return this.exit(1);
    }

    this.cmd.cwd ??= path.cwd();

    if (!name && this.cmd.dir) {
      name = path.basename(this.cmd.dir);
    } else if (name && !this.cmd.dir) {
      this.cmd.dir = path.resolve(this.cmd.cwd, name);
    } else if (!name && !this.cmd.dir) {
      console.error('Either a name or a target directory are required');
      return this.exit(1);
    }

    const ctx = new Context(name, this.cmd.template, path.resolve(this.cmd.cwd, this.cmd.dir));

    if (!this.cmd.force) {
      await ctx.initialize();
    }

    try {
      for await (const feature of this.#resolveFeatures(FEATURES)) {
        await ctx.resolveFeature(feature);
      }
    } catch (err) {
      if (err instanceof Error) {
        console.error('Failed to provide correct input', err.message);
      }
      return this.exit(1);
    }

    console.log(cliTpl`\n${{ title: 'Creating Application' }}\n${'-'.repeat(30)}`);

    await GlobalTerminal.streamLinesWithWaiting(ctx.install(), {
      position: 'bottom',
      end: true,
      commitedPrefix: '>',
      cycleDelay: 100
    });
  }
}