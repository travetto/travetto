module.exports = function init(program) {
  return program.command('test')
    .arguments('[regexes...]')
    .option('-f, --format <format>', 'Output format for test results', /^(tap|json|noop|exec)$/, 'tap')
    .option('-m, --mode <mode>', 'Test run mode', /^(single|all)$/, 'all')
    .action((args, cmd) => {
      process.env.ENV = 'test';

      if (args.length === 0) {
        cmd.help();
      }

      require('@travetto/base/bin/bootstrap').run(x => {
        const { Runner } = require('../src/runner/runner');
        return new Runner({
          format: cmd.format,
          mode: cmd.mode,
          args
        }).run();
      }).then(
        x => process.exit(x ? 0 : 1),
        e => {
          console.error(e);
          process.exit(1);
        });
    });
};