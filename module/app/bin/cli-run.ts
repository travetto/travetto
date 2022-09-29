import * as fs from 'fs/promises';

import { CliCommand, OptionConfig, ListOptionConfig } from '@travetto/cli/src/command';
import { EnvInit } from '@travetto/base/bin/init';
import { color, EnvUtil, PathUtil } from '@travetto/boot';

import { AppListUtil } from '../support/bin/list';
import { AppRunUtil } from '../support/bin/run';
import { HelpUtil } from '../support/bin/help';

function hasChildren(e: Error): e is Error & { errors: Error[] } {
  return !!e && ('errors' in e);
}

type Options = {
  env: OptionConfig<string>;
  profile: ListOptionConfig<string>;
  resource: ListOptionConfig<string>;
};

/**
 * The main entry point for the application cli
 */
export class AppRunCommand extends CliCommand<Options> {
  name = 'run';
  allowUnknownOptions = true;

  /**
   * Add help output
   */
  async help(): Promise<string> {
    return [
      '',
      color`${{ title: 'Available Applications:' }}`,
      '',
      HelpUtil.generateAppHelpList(await AppListUtil.getList()),
      ''
    ].join('\n');
  }

  getOptions(): Options {
    return {
      env: this.option({ desc: 'Application environment' }),
      profile: this.listOption({ desc: 'Additional application profiles' }),
      resource: this.listOption({ desc: 'Additional resource locations' })
    };
  }

  getArgs(): string {
    return '[application] [args...]';
  }

  envInit(): void {
    EnvInit.init({
      env: this.cmd.env,
      dynamic: !EnvUtil.isFalse('TRV_DYNAMIC'),
      append: {
        TRV_PROFILES: this.cmd.profile,
        TRV_RESOURCES: this.cmd.resource
      }
    });
  }

  /**
   * Main action
   */
  async action(app: string, args: string[]): Promise<void> {
    try {
      // Find app
      const selected = await AppListUtil.findByName(app);

      // If app not found
      if (!selected) {
        return await this.showHelp(app ? `${app} is an unknown application` : '');
      } else {

        // Run otherwise
        try {
          await AppRunUtil.run(selected, ...args);
          process.exit(0);
        } catch (err) {
          if (!err || !(err instanceof Error)) {
            throw err;
          }
          const { StacktraceUtil } = await import('@travetto/base');
          console.error(color`${{ failure: 'Failed to run' }} ${{ title: selected.name }}, ${err.message.replace(/via=.*$/, '')}`);
          if (hasChildren(err)) {
            console.error(err.errors.map((x: { message: string }) => color`● ${{ output: x.message }}`).join('\n'));
          } else {
            const stack = StacktraceUtil.simplifyStack(err);
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
      await this.showHelp(outerErr, `\nUsage: ${HelpUtil.getAppUsage((await AppListUtil.findByName(app))!)}`);
    }
  }

  async jsonIpc(app: string, args: string[]): Promise<unknown | undefined> {
    if (!app) {
      return;
    } else {
      return { name: app, args };
    }
  }

  /**
   * Tab completion support
   */
  override async complete(): Promise<Record<string, string[]>> {
    const apps = await AppListUtil.getList() || [];

    const profiles = (await fs.readdir(PathUtil.cwd))
      .filter(x => /[.]ya?ml/.test(x))
      .map(x => x.replace(/[.]ya?ml/, ''));

    return {
      '': apps.map(x => x.name).concat(['--env', '--profile']),
      '--profile': profiles,
      '-p': profiles,
    };
  }
}