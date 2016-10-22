import * as mocha from "mocha";
import { Handler } from './types';

class SuiteManager {
  private suites: mocha.ISuite[] = [];

  constructor(private handler: Handler, name: string = 'encore') {
    if (handler.init) {
      handler.init();
    }
    (mocha as any).interfaces[name] = (suite: mocha.ISuite) => this.withUi(suite);
  }

  suitePreRun(done: Function) {
    if (this.handler.setup) {
      this.handler.setup().then(() => { this.suitePreRun = process.nextTick }).then(() => done());
    } else {
      this.suitePreRun = process.nextTick;
      done();
    }
  }

  withUi(suite: mocha.ISuite) {
    this.suites.push(suite);
    (suite as any).on('pre-require', (context: any, file: any, mocha: any) => {
      this.preRequire(context, file, mocha);
    });
  }

  setupContext(context: any) {
    let common = require('mocha/lib/interfaces/common')(this.suites, context);

    context.suiteSetup((done: Function) => this.suitePreRun(done));
    context.setup = common.beforeEach;
    context.teardown = common.afterEach;
    context.suiteSetup = common.before;
    context.suiteTeardown = common.after;
    context.describe = (title: string, fn: Function) => this.buildSuite(title, fn);
    context.it = (name: string, fn: Function) => this.buildTest(name, fn);
  }

  buildSuite(title: string, fn: Function) {
    let Suite = require('mocha/lib/suite');
    let suite = Suite.create(this.suites[0], title);
    this.suites.unshift(suite);
    fn();
    this.suites.shift();
  }

  execTestAsync(fn: Function, done: Function) {
    if (this.handler.before) this.handler.before();
    fn().then(done).catch((e: any) => {
      console.log("Gen Error", e);
      done(e)
    })
      .then(
      (e: any) => { this.handler.after && this.handler.after(); return e },
      (e: any) => { this.handler.after && this.handler.after(); throw e },
    );
  }

  execTestSync(fn: Function, done: Function) {
    let cb = fn.toString().indexOf('(done)') >= 0;
    try {
      if (this.handler.before) this.handler.before();
      fn(cb ? done : undefined);
      !done && done();
    } catch (e) {
      done(e);
    } finally {
      if (this.handler.after) this.handler.after();
    }
  }

  buildTest(name: string, fn: Function) {
    let Test = require('mocha/lib/test');
    let gen = fn.toString().indexOf('yield ') >= 0;
    let op = (gen ? this.execTestAsync : this.execTestSync).bind(this, fn);
    let test = new Test(name, function (done: mocha.IContextDefinition) {
      this.timeout(this.handler.defaultTimeout);
      done.timeout = this.timeout.bind(this);
      this.handler.exec ? this.handler.exec(op.bind(null, done)) : op(done);
    });
    (this.suites[0] as any).addTest(test);
  }


  preRequire(context: any, file: any, mocha: any) {
    this.setupContext(context);
  }
}

export function registerTest(handler: Handler) {
  return new SuiteManager(handler);
}