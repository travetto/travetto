import { declareSuite, initialize } from './util';
import { addStackFilters } from '@encore2/base';
import { RootRegistry } from '@encore2/registry';

addStackFilters('mocha/lib/run');

let Test = require('mocha/lib/test');
let Common = require('mocha/lib/interfaces/common');

let requireBaseline: Set<string>;

module.exports = function (suite: any) {
  let suites = [suite];
  suite.on('pre-require', function (ctx: any, file: any, mocha: any) {
    mocha.fullTrace(true);

    if (!requireBaseline) {
      requireBaseline = new Set(Object.keys(require.cache));
    } else {
      console.log('Resetting require cache');
      for (let k of Object.keys(require.cache)) {
        if (!requireBaseline.has(k)) {
          delete require.cache[k];
        }
      }
    }

    let cmn = Common(suites, ctx, mocha);

    ctx.before = cmn.before;
    ctx.after = cmn.after;
    ctx.beforeEach = cmn.beforeEach;
    ctx.afterEach = cmn.afterEach;

    initialize();

    // Clear out before each test
    RootRegistry.empty();

    cmn.runWithSuite(suite);

    ctx.describe = ctx.ctx =
      (title: string, fn: Function) => cmn.suite.create({ title, file, fn: declareSuite(fn) });

    ctx.xdescribe = ctx.xctx = ctx.describe.skip =
      (title: string, fn: Function) => cmn.suite.skip({ title, file, fn });

    ctx.describe.only =
      (title: string, fn: Function) => cmn.suite.only({ title, file, fn: declareSuite(fn) });

    ctx.it = ctx.specify = (title: string, fn: Function | null) => {
      let singleSuite = suites[0];
      let test = new Test(title, singleSuite.isPending() ? null : fn);
      test.file = file;
      singleSuite.addTest(test);
      return test;
    };

    ctx.it.only =
      (title: string, fn: Function) => cmn.test.only(mocha, ctx.it(title, fn));

    ctx.xit = ctx.xspecify = ctx.it.skip = (title: string) => ctx.it(title);

    ctx.it.retries = (n: number) => ctx.retries(n);
  });
};