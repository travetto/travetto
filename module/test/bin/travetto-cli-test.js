//@ts-check
const os = require('os');

async function runTests(opts, args) {
  try {
    await require('@travetto/base/bin/bootstrap').run();

    const { Runner } = require('../src/runner/runner');
    const res = await new Runner({
      format: opts.format,
      mode: opts.mode,
      concurrency: opts.concurrency,
      args
    }).run();
    process.exit(res ? 0 : 1);
  } catch (e) {
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
  }
}

if (require.main !== module) {
  // @ts-ignore
  const { Util: { program } } = require('@travetto/cli/src/util');
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
        await runTests(cmd, args);
      });
  };
} else { // Run single mode, directly
  runTests({
    format: process.env.TEST_FORMAT || 'tap',
    mode: process.env.TEST_MODE || 'single',
    concurrency: parseInt(process.env.TEST_CONCURRENCY || '1', 10)
  }, process.argv.slice(2));
}