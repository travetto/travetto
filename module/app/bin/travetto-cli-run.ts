import * as fs from 'fs';
import * as commander from 'commander';

import { Util, CompletionConfig } from '@travetto/cli/src/util';
import { color } from '@travetto/cli/src/color';

import { handleFailure, CachedAppConfig } from './lib/util';
import { AppListUtil } from './lib/app-list';
import { RunUtil } from './lib/run';

interface AppCommand {
  watchReal: boolean;
  env?: string;
}

let listHelper: Function;
let apps: CachedAppConfig[];

function getAppUsage(app: CachedAppConfig) {
  let usage = app.name;

  if (app.params) {
    usage = color`${{ identifier: usage }} ${app.params.map(p => {
      const type = RunUtil.getParamType(p);

      return p.optional ?
        (p.def !== undefined ?
          color`[${{ param: p.name }}:${{ type }}=${{ input: p.def }}]` :
          color`[${{ param: p.name }}:${{ type }}]`
        ) : color`${{ param: p.name }}:${{ type }}`;
    }).join(' ')}`;
  }

  return usage;
}

function generateAppHelpList(confs: CachedAppConfig[], cmd: AppCommand) {
  const choices = [];
  if (!confs.length) {
    return color`\nNo applications defined, use ${{ type: '@Application' }} to registry entry points`;
  }
  for (const conf of confs) {
    const lines = [];

    const root = conf.appRoot !== '.' ? color`[${{ subtitle: conf.appRoot }}${!conf.standalone ? '^' : ''}] ` : '';
    const usage = getAppUsage(conf);

    const features = [];
    let featureStr = '';
    if (cmd.watchReal || (conf.watchable && cmd.env !== 'prod')) {
      features.push('{watch}');
    }
    if (features.length) {
      featureStr = ` | ${features.join(' ')}`;
    }

    lines.push(color`${root}${{ identifier: conf.name }}${featureStr}`);
    if (conf.description) {
      lines.push(color`desc:  ${{ description: conf.description ?? '' }}`);
    }
    lines.push(`usage: ${usage}`);

    // eslint-disable-next-line no-control-regex
    const len = lines.reduce((acc, v) => Math.max(acc, v.replace(/\x1b\[\d+m/g, '').length), 0);
    lines.splice(1, 0, '-'.repeat(len));

    choices.push(lines.join('\n     '));
  }
  return choices.map(x => `   ● ${x}`).join('\n\n');
}

export async function setup() {
  try {
    apps = await AppListUtil.getList();
    listHelper = generateAppHelpList.bind(null, apps, {} as any);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

export function init() {
  return Util.program
    .command('run [application] [args...]')
    .on('--help', () => {
      console.log(color`\n${{ title: 'Available Applications:' }}`);
      console.log(`\n${listHelper()}\n`);
    })
    .allowUnknownOption()
    .option('-e, --env [env]', 'Application environment (dev|prod), (default: dev)', /^(dev|prod)$/i)
    .option('-r, --root [root]', 'Application root, defaults to associated root by name')
    .option('-w, --watch [watch]', 'Run the application in watch mode, (default: auto)', Util.BOOLEAN_RE)
    .option('-p, --profile [profile]', 'Specify additional application profiles', (v, ls) => { ls.push(v); return ls; }, [])
    .action(async (app: string, args: string[], cmd: commander.Command & AppCommand) => {
      cmd.watchReal = Util.TRUE_RE.test(cmd.watch ?? '');

      cmd.profile = [
        ...(cmd.profile ?? []),
        ...(process.env.PROFILE ?? '').split(/,/g)
      ]
        .filter(x => !!x)
        .map(x => x.trim());

      if (cmd.env) {
        process.env.ENV = cmd.env; // Preemptively set b/c env changes how we compile some things
      } else {
        cmd.env = (process.env.ENV ?? process.env.env) || undefined;
      }
      if (cmd.root) {
        process.env.APP_ROOTS = cmd.root;
      }
      if (cmd.profile) {
        process.env.PROFILE = cmd.profile.join(',');
      }
      if (cmd.watch) {
        process.env.WATCH = `${cmd.watch}`;
      }

      try {
        let selected = apps.find(x => x.name === app);

        if (!app) {
          const rootApps = apps.filter(x => x.appRoot === '.');
          if (rootApps.length === 1) {
            selected = rootApps[0];
            app = selected.name;
            console.log('No app selected, defaulting to', app, 'as the only root target');
          }
        }

        if (!selected) {
          if (apps.length) {
            listHelper = generateAppHelpList.bind(null, apps, cmd);
          }
          Util.showHelp(cmd, app ? `${app} is an unknown application` : 'You must specify an application to run');
        }
        await RunUtil.run([app, ...args]);
      } catch (err) {
        if (err.message.startsWith('Invalid parameter')) {
          console.error(err.message);
          console.error();
          console.error(`Usage: ${getAppUsage((await AppListUtil.getByName(app))!)}`);
          process.exit(1);
        } else {
          handleFailure(err), 1;
        }
      }
    });
}

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