import { declareSuite, runWhenReady } from './util';

let Test = require('mocha/lib/test');
let Common = require('mocha/lib/interfaces/common');

module.exports = function (suite: any) {
  let suites = [suite];
  suite.on('pre-require', function (ctx: any, file: any, mocha: any) {
    let cmn = Common(suites, ctx, mocha);

    ctx.before = cmn.before;
    ctx.after = cmn.after;
    ctx.beforeEach = cmn.beforeEach;
    ctx.afterEach = cmn.afterEach;

    if (mocha.options.delay) {
      process.nextTick(() =>
        runWhenReady(cmn.runWithSuite(suite)));
    }

    ctx.describe = ctx.ctx =
      (title: string, fn: Function) => cmn.suite.create({ title, file, fn: declareSuite(fn) });

    ctx.xdescribe = ctx.xctx = ctx.describe.skip =
      (title: string, fn: Function) => cmn.suite.skip({ title, file, fn });

    ctx.describe.only =
      (title: string, fn: Function) => cmn.suite.only({ title, file, fn: declareSuite(fn) });

    ctx.it = ctx.specify = (title: string, fn: Function | null) => {
      let suite = suites[0];
      let test = new Test(title, suite.isPending() ? null : fn);
      test.file = file;
      suite.addTest(test);
      return test;
    };

    ctx.it.only =
      (title: string, fn: Function) => cmn.test.only(mocha, ctx.it(title, fn));

    ctx.xit = ctx.xspecify = ctx.it.skip = (title: string) => ctx.it(title);

    ctx.it.retries = (n: number) => ctx.retries(n);
  });
};