import * as fs from 'fs';
import * as commander from 'commander';

import { CliUtil } from '@travetto/cli/src/util';
import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { color } from '@travetto/cli/src/color';

import { AppListManager } from './lib/list';
import { RunUtil } from './lib/run';
import { HelpUtil } from './lib/help';

/**
 * The main entry point for the application cli
 */
export class AppRunPlugin extends BasePlugin {
  name = 'run';

  /**
   * Add help output
   */
  async help() {
    return [
      '',
      color`${{ title: 'Available Applications:' }}`,
      '',
      HelpUtil.generateAppHelpList(await AppListManager.getList()),
      ''
    ].join('\n');
  }

  init(cmd: commander.Command) {
    return cmd
      .arguments('[application] [args...]')
      .allowUnknownOption()
      .option('-e, --env [env]', 'Application environment (dev|prod|<any>)', 'dev')
      .option('-r, --root [root]', 'Application root, defaults to associated root by name')
      .option('-w, --watch [watch]', 'Run the application in watch mode, requires @travetto/watch (default: auto)', CliUtil.isBoolean)
      .option('-p, --profile [profile]', 'Specify additional application profiles', (v, ls) => { ls.push(v); return ls; }, [] as string[]);
  }

  /**
   * Main action
   */
  async action(app: string, args: string[]) {
    try {
      // Find app
      const selected = await AppListManager.findByName(app);

      // If app not found
      if (!selected) {
        // Show help always exists when it's done
        this.showHelp(app ? `${app} is an unknown application` : 'You must specify an application to run');
      } else {
        // Run otherwise
        await RunUtil.run(app, ...args);
      }
    } catch (err) {
      this.showHelp(err.message, `\nUsage: ${HelpUtil.getAppUsage((await AppListManager.findByName(app))!)}`);
    }
  }

  /**
   * Tab completion support
   */

  async complete() {
    const apps = await AppListManager.getList() || [];
    const env = ['prod', 'dev'];
    const bool = ['yes', 'no'];

    const profiles = fs.readdirSync(process.cwd())
      .filter(x => x.endsWith('.yml'))
      .map(x => x.replace('.yml', ''));

    return {
      '': apps.map(x => x.name).concat(['--env', '--watch', '--profile']),
      '--env': env,
      '-e': env,
      '--watch': bool,
      '-w': bool,
      '--profile': [...profiles, 'application'],
      '-p': [...profiles, 'application'],
    };
  }
}
