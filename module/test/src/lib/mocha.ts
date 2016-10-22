import * as mocha from "mocha";
import { Handler } from './types';
let Suite = require('mocha/lib/suite');
let Test = require('mocha/lib/test');

export function registerTest(handler: Handler) {
  if (handler.init) {
    handler.init();
  } else {
    (mocha as any).interfaces['encore'] = (suite: mocha.ISuite) => {
      let suites: mocha.ISuite[] = [suite];
      (suite as any).on('pre-require',
        preRequire.bind(null, handler, suites));
    }
  }
}

function preRequire(handler: Handler, suites: mocha.ISuite[], context: any, file: any, mocha: any) {
  let common = require('mocha/lib/interfaces/common')(suites, context);
  let init = (done: Function) => doInit(done);
  let doInit: Function = (done: Function) => {
    if (handler.setup) {
      handler.setup().then(() => { doInit = process.nextTick }).then(() => done());
    } else {
      doInit = process.nextTick;
      done();
    }
  }

  context.suiteSetup(init)

  context.setup = common.beforeEach;
  context.teardown = common.afterEach;
  context.suiteSetup = common.before;
  context.suiteTeardown = common.after;

  context.describe = (title: string, fn: Function) => {
    let suite = Suite.create(suites[0], title);
    suites.unshift(suite);
    fn();
    suites.shift();
  };

  context.it = (name: string, fn: Function) => {
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
    (suites[0] as any).addTest(new Test(name, function (done: mocha.IContextDefinition) {
      this.timeout(handler.defaultTimeout);
      done.timeout = this.timeout.bind(this);
      handler.exec ? handler.exec(op.bind(null, done)) : op(done);
    }));
  }
}