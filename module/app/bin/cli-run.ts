import * as fs from 'fs';
import * as commander from 'commander';

import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { color } from '@travetto/cli/src/color';
import { EnvInit } from '@travetto/base/bin/init';
import { PathUtil } from '@travetto/boot';

import { AppListUtil } from './lib/list';
import { AppRunUtil } from './lib/run';
import { HelpUtil } from './lib/help';

type Config = {
  env?: string;
  profile: string[];
  resource: string[];
};

/**
 * The main entry point for the application cli
 */
export class AppRunPlugin extends BasePlugin<Config> {
  name = 'run';

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

  init(cmd: commander.Command) {
    return cmd
      .arguments('[application] [args...]')
      .allowUnknownOption()
      .option('-e, --env [env]', 'Application environment (dev|prod|<other>)')
      .option('-p, --profile [profile]', 'Specify additional application profiles', (v, ls) => { ls.push(v); return ls; }, [] as string[])
      .option('-r, --resource [resources]', 'Specify additional resource locations', (v, ls) => { ls.push(v); return ls; }, [] as string[]);
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
        EnvInit.init({
          env: this.opts.env, watch: selected.watch,
          append: {
            TRV_PROFILES: this.opts.profile,
            TRV_RESOURCES: this.opts.resource
          }
        });

        // Run otherwise
        try {
          await AppRunUtil.run(selected, ...args);
          process.exit(0);
        } catch (err) {
          const { StacktraceUtil } = await import('@travetto/base');
          console.error(color`${{ failure: 'Failed application run' }}`);
          console.error(StacktraceUtil.simplifyStack(err));
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

  async complete() {
    const apps = await AppListUtil.getList() || [];
    const env = ['prod', 'dev'];

    const profiles = fs.readdirSync(PathUtil.cwd)
      .filter(x => x.endsWith('.yml'))
      .map(x => x.replace('.yml', ''));

    return {
      '': apps.map(x => x.name).concat(['--env', '--profile']),
      '--env': env,
      '-e': env,
      '--profile': profiles,
      '-p': profiles,
    };
  }
}
