module.exports = function init(program) {
  return program
    .command('run [application]')
    .option('-e, --env <env>', 'Application environment', /^(dev|test|e2e|prod)$/i, 'dev')
    .option('-w, --watch [watch]', 'Run the application in watch mode', x => /^(true|yes|on)$/i.test(x), undefined)
    .option('-p, --profile <profile>', 'Specify additional application profiles', (v, ls) => { ls.push(v); }, [])
    .action((app, cmd) => {

      if (!app) {
        cmd.help();
      }

      process.env.TRV_APP = app;
      process.env.ENV = cmd.env;
      process.env.PROFILE = [app, ...((process.env.PROFILE || '').split(/,+/g)), ...cmd.profile]
        .filter(x => !!x)
        .map(x => x.trim())
        .join(',');

      if (cmd.watch !== undefined) {
        process.env.WATCH = program.watch;
        process.env.NO_WATCH = !program.watch;
      }
      require('./bootstrap').run();
    });
};