import {suite, beforeRun} from './suite';
let Test = require('mocha/lib/test');

let interfaces = require('mocha/lib/interfaces');

interfaces.encore = function (suite) {
  let suites = [suite];

  suite.on('pre-require', function (context, file, mocha) {
    let common = require('mocha/lib/interfaces/common')(suites, context, mocha);

    if (mocha.options.delay) {
      beforeRun(() => common.runWithSuite(suite))
    }

    Object.assign(context, {
      before : common.before,
      after : common.after,
      beforeEach : common.beforeEach,
      afterEach : common.afterEach,
      describe : (title, fn) => common.suite.create({title, file, suite(fn)}),
      describeOnly : (title, fn) => common.suite.only({title, file, suite(fn)}),
      skip : (title, fn) => common.suite.skip({title, file, fn}),      

      it : (title, fn) => {
        let suite = suites[0];
        if (suite.isPending()) {
          fn = null;
        }
        let test = new Test(title, fn);
        test.file = file;
        suite.addTest(test);
        return test;
      },
      itOnly : (title, fn) => common.test.only(mocha, context.it(title, fn)),
      itSkip : (title) => context.it(title),
      itRetries : (n) => context.retries(n)
    });

    context.xdescribe = context.xcontext = context.describe;
    context.describe.only = context.describeOnly;
    context.specify = context.it;
    context.it.only = context.itOnly;
    context.xit = context.xspecify = context.it.skip = context.itSkip;
    context.it.retries = context.itRetries;
  });
};