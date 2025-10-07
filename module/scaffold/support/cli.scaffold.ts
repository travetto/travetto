import path from 'node:path';

import { prompt } from 'enquirer';

import { CliCommandShape, CliCommand, cliTpl } from '@travetto/cli';
import { Terminal } from '@travetto/terminal';

import { Context } from './bin/context.ts';
import { Feature, FEATURES } from './bin/features.ts';

/**
 * Command to run scaffolding
 */
@CliCommand()
export class ScaffoldCommand implements CliCommandShape {
  /** Template */
  template = 'todo';
  /** Current Working Directory override */
  cwd: string = path.resolve();
  /** Target Directory */
  dir?: string;
  /** Force writing into an existing directory */
  force = false;

  async #getName(name?: string): Promise<string> {
    if (!name) {
      const response = await prompt<{ name: string }>([
        {
          type: 'input',
          name: 'name',
          message: 'Enter a name for application: '
        }
      ]);
      name = response.name;
    }
    return name;
  }

  async #chooseFeature(feature: Feature): Promise<Feature | undefined> {
    const choice: (Parameters<typeof prompt>[0] & { type: 'select' }) = {
      type: 'select' as const,
      name: 'choice',
      message: 'Please select one',
      initial: feature.default,
      choices: feature.choices!.map(x => x.title).filter((x?: string): x is string => !!x),
    };

    const response = await prompt<{ choice: string }>(choice);
    return feature.choices?.find(x => x.title === response.choice);
  }

  async * #resolveFeatures(features: Feature[], chosen = false, depth = 0): AsyncGenerator<Feature> {
    for (const feat of features) {
      if (!chosen && !feat.required) {
        const ans = await prompt<{ choice: boolean | string }>([{
          type: 'confirm',
          name: 'choice',
          message: `${'='.repeat(depth * 2)}${depth > 0 ? '| ' : ''}Include ${feat.title} support?`,
          initial: true
        }]);

        if (ans.choice === 'No' || ans.choice === false) {
          continue;
        }
      }

      if (feat.choices) {
        const choice = await this.#chooseFeature(feat);
        if (choice) {
          yield* this.#resolveFeatures([choice], true, depth);
        } else {
          throw new Error(`Invalid choice: ${feat}`);
        }
      }

      yield* this.#resolveFeatures(feat.addons ?? [], false, depth + 1);

      yield feat;
    }
  }

  async main(name?: string): Promise<void> {
    name = await this.#getName(name);

    if (!name && this.dir) {
      name = path.basename(this.dir);
    } else if (name && !this.dir) {
      this.dir = path.resolve(this.cwd, name);
    } else if (!name && !this.dir) {
      throw new Error('Either a name or a target directory are required');
    }

    const ctx = new Context(name, this.template, path.resolve(this.cwd, this.dir!));

    if (!this.force) {
      await ctx.initialize();
    }

    for await (const feature of this.#resolveFeatures(FEATURES)) {
      await ctx.resolveFeature(feature);
    }

    console.log(cliTpl`\n${{ title: 'Creating Application' }}\n${'-'.repeat(30)}`);

    await new Terminal().streamLines(ctx.install());
  }
}