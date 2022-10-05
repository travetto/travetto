import * as fs from 'fs/promises';

import { CliCommand, OptionConfig, ListOptionConfig } from '@travetto/cli';
import { EnvInit } from '@travetto/base/support/bin/init';
import { CliUtil, EnvUtil, PathUtil } from '@travetto/boot';

import { AppListLoader } from './bin/list';
import { AppRunUtil } from './bin/run';
import { HelpUtil } from './bin/help';

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
      CliUtil.color`${{ title: 'Available Applications:' }}`,
      '',
      HelpUtil.generateAppHelpList(await AppListLoader.getList()),
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
      const selected = await AppListLoader.findByName(app);

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
          const { StacktraceUtil: StacktraceManager } = await import('@travetto/base');
          console.error(CliUtil.color`${{ failure: 'Failed to run' }} ${{ title: selected.name }}, ${err.message.replace(/via=.*$/, '')}`);
          if (hasChildren(err)) {
            console.error(err.errors.map((x: { message: string }) => CliUtil.color`● ${{ output: x.message }}`).join('\n'));
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
      await this.showHelp(outerErr, `\nUsage: ${HelpUtil.getAppUsage((await AppListLoader.findByName(app))!)}`);
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
    const apps = await AppListLoader.getList() || [];

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