import * as fs from 'fs/promises';

import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { color } from '@travetto/cli/src/color';
import { EnvInit } from '@travetto/base/bin/init';
import { EnvUtil, PathUtil } from '@travetto/boot';

import { AppListUtil } from './lib/list';
import { AppRunUtil } from './lib/run';
import { HelpUtil } from './lib/help';

/**
 * The main entry point for the application cli
 */
export class AppRunPlugin extends BasePlugin {
  name = 'run';
  allowUnknownOptions = true;

  /**
   * Add help output
   */
  async help() {
    return [
      '',
      color`${{ title: 'Available Applications:' }}`,
      '',
      HelpUtil.generateAppHelpList(await AppListUtil.getList()),
      ''
    ].join('\n');
  }

  getOptions() {
    return {
      env: this.option({ desc: 'Application environment' }),
      profile: this.listOption({ desc: 'Additional application profiles' }),
      resource: this.listOption({ desc: 'Additional resource locations' })
    };
  }

  getArgs() {
    return '[application] [args...]';
  }

  envInit() {
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
  async action(app: string, args: string[]) {
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
          const { StacktraceUtil } = await import('@travetto/base');
          console.error(color`${{ failure: 'Failed to run' }} ${{ title: selected.name }}, ${err.message.replace(/via=.*$/, '')}`);
          if ('errors' in err) {
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
    } catch (err) {
      await this.showHelp(err, `\nUsage: ${HelpUtil.getAppUsage((await AppListUtil.findByName(app))!)}`);
    }
  }

  /**
   * Tab completion support
   */

  override async complete() {
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