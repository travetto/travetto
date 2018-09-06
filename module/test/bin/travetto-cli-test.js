//@ts-check
// @ts-ignore
const { Util: { program } } = require('@travetto/cli/src/util');
const os = require('os');

module.exports = function() {
  program.command('test')
    .arguments('[regexes...]')
    .option('-f, --format <format>', 'Output format for test results', /^(tap|json|noop|exec|event)$/, 'tap')
    .option('-c, --concurrency <concurrency>', 'Number of tests to run concurrently', undefined, os.cpus().length - 1)
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
          concurrency: cmd.concurrency,
          args
        }).run();
        process.exit(res ? 0 : 1);
      } catch (e) {
        console.error(e);
        process.exit(1);
      }
    });
};