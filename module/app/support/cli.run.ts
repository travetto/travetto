import { CliUtil, CliCommand, OptionConfig, ListOptionConfig } from '@travetto/cli';
import { Env, ErrorUtil } from '@travetto/base';

import { AppListLoader } from './bin/list';
import { AppRunUtil } from './bin/run';
import { HelpUtil } from './bin/help';

function hasChildren(e: Error): e is Error & { errors: Error[] } {
  return !!e && ('errors' in e);
}

type Options = {
  env: OptionConfig<string>;
  profile: ListOptionConfig<string>;
};

/**
 * The main entry point for the application cli
 */
export class AppRunCommand extends CliCommand<Options> {
  #loader: AppListLoader = new AppListLoader();

  name = 'run';
  allowUnknownOptions = true;

  /**
   * Add help output
   */
  async help(): Promise<string> {
    return [
      '',
      CliUtil.color`${{ title: 'Available Applications:' }}`,
      '',
      HelpUtil.generateAppHelpList(await this.#loader.getList()),
      ''
    ].join('\n');
  }

  getOptions(): Options {
    return {
      env: this.option({ desc: 'Application environment' }),
      profile: this.listOption({ desc: 'Additional application profiles' })
    };
  }

  getArgs(): string {
    return '[application] [args...]';
  }

  envInit(): void {
    Env.define({
      debug: process.env.DEBUG || '0',
      env: this.cmd.env,
      append: { TRV_PROFILES: this.cmd.profile }
    });
  }

  /**
   * Main action
   */
  async action(app: string, args: string[]): Promise<void> {
    try {
      // Find app
      const selected = await this.#loader.findByName(app);

      // If app not found
      if (!selected) {
        return await this.showHelp(app ? `${app} is an unknown application` : '');
      } else {

        // Run otherwise
        try {
          return await AppRunUtil.run(selected, ...args);
        } catch (err) {
          if (!err || !(err instanceof Error)) {
            throw err;
          }
          console.error(CliUtil.color`${{ failure: 'Failed to run' }} ${{ title: selected.name }}, ${err.message.replace(/via=.*$/, '')}`);
          if (hasChildren(err)) {
            console.error(err.errors.map((x: { message: string }) => CliUtil.color`● ${{ output: x.message }}`).join('\n'));
          } else {
            const stack = ErrorUtil.cleanStack(err);
            if (!stack.includes(err.message)) {
              console.error(err.message);
            }
            console.error(stack);
          }
          process.exit(1);
        }
      }
    } catch (outerErr) {
      if (!outerErr || !(outerErr instanceof Error)) {
        throw outerErr;
      }
      await this.showHelp(outerErr, `\nUsage: ${HelpUtil.getAppUsage((await this.#loader.findByName(app))!)}`);
    }
  }

  async jsonIpc(app: string, args: string[]): Promise<unknown | undefined> {
    if (!app) {
      return;
    } else {
      return { name: app, args };
    }
  }
}