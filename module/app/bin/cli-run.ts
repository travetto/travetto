import * as fs from 'fs';
import * as commander from 'commander';

import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { color } from '@travetto/cli/src/color';
import { CliUtil } from '@travetto/cli/src/util';

import { CliAppListUtil } from './lib/list';
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
      HelpUtil.generateAppHelpList(await CliAppListUtil.getList()),
      ''
    ].join('\n');
  }

  init(cmd: commander.Command) {
    return cmd
      .arguments('[application] [args...]')
      .allowUnknownOption()
      .option('-e, --env [env]', 'Application environment (dev|prod|<any>)')
      .option('-p, --profile [profile]', 'Specify additional application profiles', (v, ls) => { ls.push(v); return ls; }, [] as string[])
      .option('-r, --resource [resourcesRoot]', 'Specify additional resource root locations', (v, ls) => { ls.push(v); return ls; }, [] as string[]);
  }

  /**
   * Main action
   */
  async action(app: string, args: string[]) {
    let runner;
    try {
      // Find app
      const selected = await CliAppListUtil.findByName(app);

      // If app not found
      if (!selected) {
        return await this.showHelp(app ? `${app} is an unknown application` : '');
      } else {
        await CliUtil.initAppEnv({ env: this._cmd.env, profiles: this._cmd.profile, resourceRoots: this._cmd.resource, watch: true });
        // Run otherwise
        runner = await RunUtil.getRunner(app, ...args);
      }
    } catch (err) {
      await this.showHelp(err, `\nUsage: ${HelpUtil.getAppUsage((await CliAppListUtil.findByName(app))!)}`);
    }
    if (runner) {
      try {
        await runner();
        process.exit(0);
      } catch (err) {
        console.error(err);
        process.exit(1);
      }
    }
  }

  /**
   * Tab completion support
   */

  async complete() {
    const apps = await CliAppListUtil.getList() || [];
    const env = ['prod', 'dev'];

    const profiles = fs.readdirSync(process.cwd())
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
