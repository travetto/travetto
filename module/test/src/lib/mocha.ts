import * as mocha from "mocha";
import { Handler } from './types';
let Suite = require('mocha/lib/suite');
let Test = require('mocha/lib/test');

function buildTest(handler: Handler, name: string, fn: Function) {
  let test = null;
  let cb = fn.toString().indexOf('(done)') >= 0;
  let gen = fn.toString().indexOf('yield ') >= 0;
  let op: Function;

  if (gen) {
    op = (done: Function) => {
      if (handler.before) handler.before();
      fn().then(done).catch((e: any) => {
        console.log("Gen Error", e);
        done(e)
      })
        .then(
        (e: any) => { handler.after && handler.after(); return e },
        (e: any) => { handler.after && handler.after(); throw e },
      );
    }
  } else {
    op = (done: Function) => {
      try {
        if (handler.before) handler.before();
        fn(cb ? done : undefined);
        !cb && done();
      } catch (e) {
        done(e);
      } finally {
        if (handler.after) handler.after();
      }
    }
  }
  return new Test(name, function (done: mocha.IContextDefinition) {
    this.timeout(handler.defaultTimeout);
    done.timeout = this.timeout.bind(this);
    handler.exec ? handler.exec(op.bind(null, done)) : op(done);
  });
}

function buildSuite(suites: mocha.ISuite[], title: string, fn: Function) {
  let suite = Suite.create(suites[0], title);
  suites.unshift(suite);
  fn();
  suites.shift();
}

function buildInit(handler: Handler) {
  let doInit: Function = (done: Function) => {
    if (handler.setup) {
      handler.setup().then(() => { doInit = process.nextTick }).then(() => done());
    } else {
      doInit = process.nextTick;
      done();
    }
  }

  let init = (done: Function) => doInit(done);

  return (context: any, common: any) => {
    context.suiteSetup(init);

    context.setup = common.beforeEach;
    context.teardown = common.afterEach;
    context.suiteSetup = common.before;
    context.suiteTeardown = common.after;
  }
}

export function registerTest(handler: Handler) {
  if (handler.init) {
    handler.init();
  }

  let init = buildInit(handler);

  (mocha as any).interfaces['encore'] = (suite: mocha.ISuite) => {
    let suites: mocha.ISuite[] = [suite];

    (suite as any).on('pre-require', (context: any, file: any, mocha: any) => {
      let common = require('mocha/lib/interfaces/common')(suites, context);

      init(context, common);

      context.describe = buildSuite.bind(null, suites);

      context.it = (name: string, fn: Function) => {
        let test = buildTest(handler, name, fn);
        (suites[0] as any).addTest(test);
      };
    });
  };
}