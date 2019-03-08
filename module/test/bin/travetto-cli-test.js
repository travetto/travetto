// @ts-check
const os = require('os');

function init() {
  const { Util } = require('@travetto/cli/src/util');
  const Col = Util.colorize;

  return Util.program.command('test')
    .arguments('[regexes...]')
    .option('-f, --format <format>', 'Output format for test results', /^(tap|json|jsonStream|noop|exec|event)$/, 'tap')
    .option('-c, --concurrency <concurrency>', 'Number of tests to run concurrently', Math.min(4, os.cpus().length - 1))
    .option('-m, --mode <mode>', 'Test run mode', /^(single|all)$/, 'all')
    .action(async (args, cmd) => {

      const { runTests, prepareEnv } = require('./lib');

      prepareEnv();

      require('@travetto/base/bin/bootstrap');

      if (cmd.format === 'tap' && Util.HAS_COLOR) {
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

      if (args.length === 0 && cmd.mode === 'all') {
        args = ['test/.*'];
      } else if (args.length < 1 && cmd.mode === 'single') {
        return Util.showHelp(cmd, 'You must specify a file to run in single mode');
      }

      await runTests(cmd, args);
    });
}

module.exports = { init };