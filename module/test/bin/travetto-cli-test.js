const { Util: { program } } = require('@travetto/cli/src/util');

module.exports = function() {
  program.command('test')
    .arguments('[regexes...]')
    .option('-f, --format <format>', 'Output format for test results', /^(tap|json|noop|exec)$/, 'tap')
    .option('-m, --mode <mode>', 'Test run mode', /^(single|all)$/, 'all')
    .action(async (args, cmd) => {
      process.env.ENV = 'test';

      if (args.length === 0) {
        args = ['test/.*'];
      }

      try {
        await require('@travetto/base/bin/bootstrap').run();

        const { Runner } = require('../src/runner/runner');
        const res = await new Runner({
          format: cmd.format,
          mode: cmd.mode,
          args
        }).run();
        process.exit(res ? 0 : 1);
      } catch (e) {
        console.error(e);
        process.exit(1);
      }
    });
};