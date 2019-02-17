//@ts-check
const os = require('os');

async function runTests(opts, args) {
  try {

    await require('@travetto/base/bin/bootstrap').run();

    const { Runner } = require('../src/runner/runner');
    const res = await new Runner({
      format: opts.format,
      consumer: opts.consumer,
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

function init() {
  const { Util } = require('@travetto/cli/src/util');
  const Col = Util.colorize;

  return Util.program.command('test')
    .arguments('[regexes...]')
    .option('-f, --format <format>', 'Output format for test results', /^(tap|json|jsonStream|noop|exec|event)$/, 'tap')
    .option('-c, --concurrency <concurrency>', 'Number of tests to run concurrently', os.cpus().length - 1)
    .option('-m, --mode <mode>', 'Test run mode', /^(single|all)$/, 'all')
    .action(async (args, cmd) => {
      if (args.length === 0) {
        args = ['test/.*'];
      }
      require('./init');

      if (cmd.format === 'tap' && Util.HAS_COLOR) {
        require('@travetto/base/bin/bootstrap');
        const { TapEmitter } = require('../src/consumer/tap');
        cmd.consumer = new TapEmitter(process.stdout, {
          assertDescription: Col.description,
          testDescription: Col.description,
          success: Col.success,
          failure: Col.failure,
          assertNumber: Col.identifier,
          testNumber: Col.identifier,
          assertFile: Col.path,
          assertLine: Col.input,
          objectInspect: Col.output,
          suiteName: Col.subtitle,
          testName: Col.title,
          total: Col.title
        });
      }

      await runTests(cmd, args);
    });
};

if (!process.env.TRV_CLI) {
  require('./init');
  runTests({
    format: process.env.TEST_FORMAT || 'tap',
    mode: process.env.TEST_MODE || 'single',
    concurrency: parseInt(process.env.TEST_CONCURRENCY || '1', 10)
  }, process.argv.slice(2));
}

module.exports = { init };