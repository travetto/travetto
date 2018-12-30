//@ts-check
const { getCachedAppList } = require('./travetto-find-apps');

async function getAppList() {
  try {
    return await getCachedAppList();
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

function envFromApp(app) {
  return app.filename.includes('e2e') ? 'e2e' : 'dev';
}

function generateAppHelpList(apps, cmd) {
  const choices = [];
  apps = apps.sort((a, b) => {
    let ae2e = envFromApp(a);
    let be2e = envFromApp(b);
    return ae2e === be2e ? a.name.localeCompare(b.name) : (ae2e ? b : a);
  });
  for (const conf of apps) {
    let lines = [];
    let usage = conf.name;

    if (conf.params) {
      usage = `${usage} ${conf.params.map(x => {
        return x.def ? `(${x.name}=${x.def})` : `[${x.name}]`;
      }).join(' ')}`
    }

    const features = [];
    let featureStr = '';
    if (cmd.watchReal || (conf.watchable && cmd.env !== 'prod')) {
      features.push('{watch}');
    }
    if (envFromApp(conf) === 'e2e') {
      features.push('{e2e}');
    }
    if (features.length) {
      featureStr = ` | ${features.join(' ')}`;
    }

    lines.push(`${conf.name}${featureStr}`);
    if (conf.description) {
      lines.push(`desc:  ${conf.description || ''}`);
    }
    lines.push(`usage: ${usage}`);

    const len = lines.reduce((acc, v) => Math.max(acc, v.length), 0);
    lines.splice(1, 0, '-'.repeat(len));

    choices.push(lines.join('\n       '));
  }
  return choices.map(x => `     ● ${x}`).join('\n\n');
}

function processApplicationParam(config, param) {
  if (
    (config.type === 'boolean' && !/^(true|false|1|0|yes|no|on|off)/i.test(param)) ||
    (config.type === 'number' && !/^[-]?[0-9]*[.]?[0-9]*$/.test(param)) ||
    (config.meta && config.meta.choice && !config.meta.choice.find(c => `${c}` === param))
  ) {
    throw new Error(`Invalid parameter`);
  }
  let out = param;
  switch (config.type) {
    case 'number': out = param.includes('.') ? parseFloat(param) : parseInt(param, 10); break;
    case 'boolean': out = /^(true|1|yes|on)$/i.test(param); break;
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
    }

    await require('@travetto/base/bin/bootstrap').run();
    await require('../src/registry').DependencyRegistry.runApplication(name, sub);
  } catch (err) {
    if (err.message === 'Invalid parameter') {
      // @ts-ignore
      console.error('Invalid input', sub, 'expected', app.params.map(x => (x.meta && x.meta.choice) ? x.meta.choice : x.type))
    } else {
      console.error(err && err.stack ? err.stack : err);
    }
    process.exit(1);
  }
}

//@ts-ignore
if (require.main === module) {
  runApp(process.argv.slice(2)); //If loaded directly as main entry, run, idx 2 is where non-node arguments start at
} else {
  module.exports = function () {
    let listHelper;

    // @ts-ignore
    const { Util: { program } } = require('@travetto/cli/src/util');

    program
      .command('run [application] [args...]')
      .on('--help', () => {
        console.log('\n  Available Applications:');
        if (listHelper) {
          console.log();
          console.log(listHelper());
        } else {
          console.log('\n  No applications defined, use @Application to registry entry points');
        }
        console.log();
      })
      .allowUnknownOption()
      .option('-e, --env [env]', 'Application environment (dev|test|e2e|prod), defaults to dev', /^(dev|test|e2e|prod)$/i)
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
        } else {
          cmd.env = cmd.env !== undefined ? cmd.env : envFromApp(selected);
          cmd.watch = cmd.watch !== undefined ? cmd.watchReal : (selected.watchable && cmd.env !== 'prod');
        }

        process.env.ENV = cmd.env;
        process.env.PROFILE = cmd.profile.join(',');
        process.env.WATCH = `${cmd.watch}`;
        runApp([app, ...args]);
      });
  };
}