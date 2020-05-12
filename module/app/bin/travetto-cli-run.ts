import * as fs from 'fs';
import * as commander from 'commander';

import { CliUtil } from '@travetto/cli/src/util';
import { color } from '@travetto/cli/src/color';
import { CompletionConfig } from '@travetto/cli/src/types';

import { handleFailure, CachedAppConfig } from './lib/util';
import { AppListUtil } from './lib/app-list';
import { RunUtil } from './lib/run';
import { HelpUtil, AppCommand } from './lib/help';


let listHelper: Function;
let apps: CachedAppConfig[];

/**
 * Initialize global (to the file) vars post init.  The cli plugin
 * architecture will call this automatically.
 */
export async function setup() {
  try {
    apps = await AppListUtil.getList();
    listHelper = HelpUtil.generateAppHelpList.bind(HelpUtil, apps, {});
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

/**
 * The main entry point for the application cli
 */
export function init() {
  return CliUtil.program
    .command('run [application] [args...]')
    .on('--help', () => {
      console.log(color`\n${{ title: 'Available Applications:' }}`);
      console.log(`\n${listHelper()}\n`);
    })
    .allowUnknownOption()
    .option('-e, --env [env]', 'Application environment (dev|prod|<any>)', 'dev')
    .option('-r, --root [root]', 'Application root, defaults to associated root by name')
    .option('-w, --watch [watch]', 'Run the application in watch mode, requires @travetto/watch (default: auto)', CliUtil.isBoolean)
    .option('-p, --profile [profile]', 'Specify additional application profiles', (v, ls) => { ls.push(v); return ls; }, [])
    .action(async (app: string, args: string[], cmd: commander.Command & AppCommand) => {

      // Determine if watch was passed in
      cmd.watchReal = CliUtil.isTrue(cmd.watch ?? '');

      // Setup profile
      cmd.profile = [
        ...(cmd.profile ?? []),
        ...(process.env.PROFILE ?? '').split(/,/g)
      ]
        .map(x => x.trim())
        .filter(x => !!x);

      // Process env
      if (cmd.env) {
        process.env.ENV = cmd.env; // Preemptively set b/c env changes how we compile some things
      } else {
        cmd.env = (process.env.ENV ?? process.env.env) || undefined;
      }

      // Handle root
      if (cmd.root) {
        process.env.APP_ROOTS = cmd.root;
      }
      // Join profiles if passed
      if (cmd.profile) {
        process.env.PROFILE = cmd.profile.join(',');
      }

      // Set watch if passed in
      if (cmd.watch !== undefined) {
        process.env.WATCH = `${cmd.watch}`;
      }

      try {
        // Find app
        let selected = apps.find(x => x.name === app);

        if (!app) {
          // If not defined, and there is a default local app, run it
          const rootApps = apps.filter(x => x.appRoot === '.');
          if (rootApps.length === 1) {
            selected = rootApps[0];
            app = selected.name;
            console.log('No app selected, defaulting to', app, 'as the only root target');
          }
        }

        // If app not found
        if (!selected) {
          if (apps.length) {
            // Show list
            listHelper = HelpUtil.generateAppHelpList.bind(HelpUtil, apps, cmd);
          }
          // Show help always exists when it's done
          CliUtil.showHelp(cmd, app ? `${app} is an unknown application` : 'You must specify an application to run');
        } else {
          // Run otherwise
          await RunUtil.run([app, ...args]);
        }
      } catch (err) {
        if (err.message.startsWith('Invalid parameter')) {
          console.error(err.message);
          console.error();
          console.error(`Usage: ${HelpUtil.getAppUsage((await AppListUtil.getByName(app))!)}`);
          process.exit(1);
        } else {
          handleFailure(err), 1;
        }
      }
    });
}

/**
 * Tab completion support
 */
export async function complete(c: CompletionConfig) {
  try {
    apps = await AppListUtil.getList();
    const env = ['prod', 'dev'];
    const bool = ['yes', 'no'];
    const profiles = fs.readdirSync(process.cwd())
      .filter(x => x.endsWith('.yml'))
      .map(x => x.replace('.yml', ''));

    profiles.push('application');
    c.all.push('run');
    c.task.run = {
      '': apps.map(x => x.name).concat(['--env', '--watch', '--profile']),
      '--env': env,
      '-e': env,
      '--watch': bool,
      '-w': bool,
      '--profile': profiles,
      '-p': profiles,
    };
  } catch (err) {
    handleFailure(err, 1);
  }
}