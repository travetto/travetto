import { declareSuite, beforeRun } from './suite';

let Test = require('mocha/lib/test');
let Common = require('mocha/lib/interfaces/common');

module.exports = function (suite) {
  var suites = [suite];

  suite.on('pre-require', function (context, file, mocha) {
    var common = Common(suites, context, mocha);

    context.before = common.before;
    context.after = common.after;
    context.beforeEach = common.beforeEach;
    context.afterEach = common.afterEach;

    if (mocha.options.delay) {
      beforeRun(() => common.runWithSuite(suite));
    }

    context.describe = context.context = function (title, fn) {
      return common.suite.create({ title, file, fn });
    };

    context.xdescribe = context.xcontext = context.describe.skip = function (title, fn) {
      return common.suite.skip({ title, file, fn });
    };

    context.describe.only = function (title, fn) {
      return common.suite.only({ title, file, fn });
    };

    context.it = context.specify = function (title, fn) {
      var suite = suites[0];
      if (suite.isPending()) {
        fn = null;
      }
      var test = new Test(title, fn);
      test.file = file;
      suite.addTest(test);
      return test;
    };

    context.it.only = function (title, fn) {
      return common.test.only(mocha, context.it(title, fn));
    };

    context.xit = context.xspecify = context.it.skip = function (title) {
      context.it(title);
    };

    context.it.retries = function (n) {
      context.retries(n);
    };
  });
};