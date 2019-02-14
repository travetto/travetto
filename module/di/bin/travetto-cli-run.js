//@ts-check
const path = require('path');
let colorize;

try {
  colorize = require('@travetto/cli/src/util').Util.colorize;
} catch (e) {
  colorize = v => v;
}

async function getAppList() {
  try {
    const { getCachedAppList } = require('./travetto-find-apps');
    return await getCachedAppList();
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

function getParamType(config) {
  return (config.meta && config.meta.choices) ? config.meta.choices.join('|') : config.type;
}

function getAppUsage(app) {
  let usage = app.name;

  if (app.params) {
    usage = `${colorize(usage,'white')} ${app.params.map(x => {
      const type = colorize(getParamType(x), 'green');
      const nm = colorize(x.name, 'blue');
      const def = x.def !== undefined ? colorize(x.def, 'yellow') : undefined;

      return x.optional ?  
      (x.def !== undefined ?
        `[${nm}:${type}=${def}]` : 
        `[${nm}:${type}]`
      ) : `${nm}:${type}`;
    }).join(' ')}`
  }

  return usage;
}

function generateAppHelpList(apps, cmd) {
  const choices = [];
  for (const conf of apps) {
    let lines = [];

    const root = conf.appRoot ? `[${colorize(conf.appRoot, 'gray')}] ` : '';
    const usage = getAppUsage(conf);

    const features = [];
    let featureStr = '';
    if (cmd.watchReal || (conf.watchable && cmd.env !== 'prod')) {
      features.push('{watch}');
    }
    if (features.length) {
      featureStr = ` | ${features.join(' ')}`;
    }

    lines.push(`${root}${colorize(conf.name, 'white')}${featureStr}`);
    if (conf.description) {
      lines.push(`desc:  ${colorize(conf.description || '', 'red')}`);
    }
    lines.push(`usage: ${usage}`);

    const len = lines.reduce((acc, v) => Math.max(acc, v.replace(/\x1b\[\d+m/g, '').length), 0);
    lines.splice(1, 0, '-'.repeat(len));

    choices.push(lines.join('\n       '));
  }
  return choices.map(x => `     ● ${x}`).join('\n\n');
}

function processApplicationParam(config, param) {
  if (
    (config.type === 'boolean' && !/^(true|false|1|0|yes|no|on|off)/i.test(param)) ||
    (config.type === 'number' && !/^[-]?[0-9]*[.]?[0-9]*$/.test(param)) ||
    (config.meta && config.meta.choices && !config.meta.choices.find(c => `${c}` === param))
  ) {
    throw new Error(`Invalid parameter ${colorize(config.name, 'blue')}: Received ${colorize('yellow', param)} expected ${colorize(getParamType(config), 'green')}`);
  }
  let out = param;
  switch (config.type) {
    case 'number':
      out = param.includes('.') ? parseFloat(param) : parseInt(param, 10);
      break;
    case 'boolean':
      out = /^(true|1|yes|on)$/i.test(param);
      break;
  }
  return out;
}

async function runApp(args) {
  let app;
  let [name, ...sub] = args;
  try {
    app = (await getAppList()).find(x => x.name === name);

    if (app) {
      const appParams = app.params || [];
      sub = sub.map((x, i) => appParams[i] === undefined ? x : processApplicationParam(appParams[i], x));
      const reqdCount = appParams.filter(x => !x.optional).length;
      if (sub.length < reqdCount) {
        throw new Error(`Invalid parameter count: received ${colorize(sub.length, 'yellow')} but needed ${colorize(reqdCount, 'yellow')}`);
      }
    }

    process.env.APP_ROOT = process.env.APP_ROOT || app.appRoot;
    process.env.ENV = process.env.ENV || 'dev';
    process.env.PROFILE = process.env.PROFILE || '';
    process.env.WATCH = process.env.WATCH || app.watchable;

    const { Env } = require('@travetto/base/src/env');
    await require('@travetto/base/bin/bootstrap').run();
    let registryPath = '../src/registry';

    // Handle bad symlink behavior on windows
    if (Env.frameworkDev === 'win32') {
      registryPath = path.resolve(process.env.__dirname, registryPath);
    }

    await require(registryPath).DependencyRegistry.runApplication(name, sub);
  } catch (err) {
    if (err.message.startsWith('Invalid parameter')) {
      console.error(err.message);
      console.error();
      console.error(`Usage: ${getAppUsage(app)}`);
    } else {
      console.error(err && err.stack ? err.stack : err);
    }
    process.exit(1);
  }
}

function init() {
  let listHelper;

  const { Util: { program } } = require('@travetto/cli/src/util');

  program
    .command('run [application] [args...]')
    .on('--help', () => {
      console.log('\n  Available Applications:');
      if (listHelper) {
        console.log();
        console.log(listHelper());
      } else {
        console.log(`\n  No applications defined, use ${colorize('@Application', 'yellow')} to registry entry points`);
      }
      console.log();
    })
    .allowUnknownOption()
    .option('-e, --env [env]', 'Application environment (dev|prod), defaults to dev', /^(dev|prod)$/i)
    .option('-a, --app [app]', 'Application root, defaults to associated root by name')
    .option('-w, --watch [watch]', 'Run the application in watch mode, defaults to auto', /^(1|0|yes|no|on|off|auto|true|false)$/i)
    .option('-p, --profile [profile]', 'Specify additional application profiles', (v, ls) => { ls.push(v); return ls; }, [])
    .action(async (app, args, cmd) => {
      cmd.env = cmd.env || process.env.ENV || process.env.env || undefined;
      cmd.watchReal = /^(1|yes|on|true)$/.test(cmd.watch || '');

      cmd.profile = [
          ...(cmd.profile || []),
          ...(process.env.PROFILE || '').split(/,/g)
        ]
        .filter(x => !!x)
        .map(x => x.trim());

      process.env.ENV = cmd.env; //Preemptively set b/c env changes how we compile some things

      const apps = await getAppList();
      const selected = apps.find(x => x.name === app);

      if (!selected) {
        if (apps.length) {
          listHelper = generateAppHelpList.bind(null, apps, cmd);
        }
        cmd.help();
      }

      if (cmd.app) process.env.APP_ROOT = cmd.app;
      if (cmd.env) process.env.ENV = cmd.env;
      if (cmd.profile) process.env.PROFILE = cmd.profile.join(',');
      if (cmd.watch) process.env.WATCH = `${cmd.watch}`;

      runApp([app, ...args]);
    });
}

if (!process.env.TRV_CLI) {
  runApp(process.argv.slice(2)); //If loaded directly as main entry, run, idx 2 is where non-node arguments start at
}

module.exports = { init };