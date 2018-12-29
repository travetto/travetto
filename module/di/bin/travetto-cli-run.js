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

function generateAppHelpList(apps, cmd) {
  const lines = [];
  for (const conf of apps) {
    let line = conf.name;
    if (conf.description) {
      line = `${line} -- ${conf.description}`;
    }
    const watched = cmd.watchSpecified ? cmd.watch : (conf.watchable && cmd.env !== 'prod');
    if (watched) {
      line = `${line} [watch=true]`;
    }
    const env = (!cmd.envSpecified && conf.filename.includes('e2e') && 'e2e') || cmd.env;
    line = `${line} [env=${env}]`;
    lines.push(line);
  }
  return lines.map(x => `    * ${x}`).join('\n');
}

async function runApp(app) {
  try {
    await require('@travetto/base/bin/bootstrap').run();
    await require('../src/registry').DependencyRegistry.runApplication(app);
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

//@ts-ignore
if (require.main === module) {
  runApp(process.argv.pop()); //If loaded directly as main entry, run
} else {
  module.exports = function () {
    let listHelper;

    // @ts-ignore
    const { Util: { program } } = require('@travetto/cli/src/util');

    program
      .command('run [application]')
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
      .option('-e, --env [env]', 'Application environment (dev|test|e2e|prod)', /^(dev|test|e2e|prod)$/i, 'dev')
      .option('-w, --watch', 'Run the application in watch mode')
      .option('-p, --profile [profile]', 'Specify additional application profiles', (v, ls) => { ls.push(v); return ls; }, [])
      .action(async (app, cmd) => {

        cmd.watchSpecified = cmd.watch !== undefined;
        cmd.envSpecified = !(cmd.env === undefined || (cmd.env === 'dev' && !process.argv.find(x => x === 'dev'))); // If env is default selected

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
          cmd.env = cmd.env || process.env.ENV || process.env.env;

          if (!cmd.envSpecified && selected.filename.includes('e2e')) {
            cmd.env = 'e2e';
          }
          if (!cmd.watchSpecified) {
            cmd.watch = selected.watchable && cmd.env !== 'prod';
          }
        }

        process.env.ENV = cmd.env;
        process.env.PROFILE = cmd.profile.join(',');
        process.env.WATCH = `${cmd.watch}`;

        runApp(app);
      });
  };
}