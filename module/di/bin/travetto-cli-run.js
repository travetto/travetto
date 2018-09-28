//@ts-check
// @ts-ignore
const { Util: { program } } = require('@travetto/cli/src/util');

module.exports = function() {
  let apps = [];

  program
    .command('run [application]')
    .on('--help', () => {
      console.log('\n  Available Applications:');
      if (apps.length) {
        console.log();
        console.log(apps.map(x => `    * ${x}`).join('\n'));
      } else {
        console.log('\n  No applications defined, use @Application to registry entry points');
      }
      console.log();
    })
    .option('-e, --env [env]', 'Application environment', /^(dev|test|e2e|prod)$/i, 'dev')
    .option('-w, --watch [watch]', 'Run the application in watch mode', x => /^(true|yes|on)$/i.test(x), undefined)
    .option('-p, --profile [profile]', 'Specify additional application profiles', (v, ls) => { ls.push(v); return ls; }, [])
    .action(async (app, cmd) => {

      process.env.PROFILE = [app, ...((process.env.PROFILE || '').split(/,+/g)), ...cmd.profile]
        .filter(x => !!x)
        .map(x => x.trim())
        .join(',');

      process.env.ENV = cmd.env;

      if (!app) {
        process.env.QUIET_CONFIG = 'true';
        process.env.DEBUG = 'false';
        await require('@travetto/base/bin/bootstrap').run();
        const appNames = require('../src/registry').DependencyRegistry.getApplications().sort((a, b) => a.localeCompare(b));
        if (appNames) {
          apps.push(...appNames);
        }
        cmd.help();
      }

      if (cmd.watch !== undefined) {
        const watch = /^(true|yes|on)$/i.test(cmd.watch);
        process.env.WATCH = `${watch}`;
        process.env.NO_WATCH = `${!watch}`;
      }

      try {
        await require('@travetto/base/bin/bootstrap').run();
        await require('../src/registry').DependencyRegistry.runApplication(app);
      } catch (err) {
        console.error(err && err.stack ? err.stack : err);
        process.exit(1);
      }
    });
};