import 'mocha';

export type Promisable = Promise<any> | (() => Promise<any>);
type ActionFunction = (done?: any) => any;

let _beforeTest: ActionFunction[] = [];
let _beforeSuite: ActionFunction[] = [];
let _afterTest: ActionFunction[] = [];
let _afterSuite: ActionFunction[] = [];
let _beforeAll: Promisable[] = [];
let _afterAll: Promisable[] = [];

export let INIT_TIMEOUT = 10000;
export let CLEANUP_TIMEOUT = 10000;

function isPromise(x: any): x is Promise<any> {
  return x.then && x.catch;
}

function resolveAll(arr: Promisable[]) {
  return Promise.all(arr.map(x => isPromise(x) ? x : x()));
}

export function declareSuite(fn: Function) {
  return function (this: any) {
    for (let f of _beforeSuite) { before(f); }
    for (let f of _beforeTest) { beforeEach(f); }
    for (let f of _afterTest) { afterEach(f); }
    for (let f of _afterSuite) { after(f); }
    fn.call(this);
  };
}

export function timeout<T>(delay: number, fn: (...args: any[]) => T) {
  let cb = fn.toString().indexOf('(done)') >= 0;
  if (cb) {
    return function (this: any, done?: Function) {
      this.timeout(delay);
      return fn.call(this, done) as T;
    };
  } else {
    return function (this: any) {
      this.timeout(delay);
      return fn.call(this) as T;
    };
  }
}

export function initialize() {
  before(function () {
    this.timeout(INIT_TIMEOUT);
    return resolveAll(_beforeAll);
  });
  after(function () {
    this.timeout(CLEANUP_TIMEOUT);
    return resolveAll(_afterAll);
  });
}

export const adder = <T>(arr: T[]) => (t: T) => arr.push(t);
export const beforeAll = adder(_beforeAll);
export const beforeSuite = adder(_beforeSuite);
export const beforeTest = adder(_beforeTest);
export const afterSuite = adder(_afterSuite);
export const afterTest = adder(_afterTest);
export const afterAll = adder(_afterAll);

// Support di if loaded
require('../opt/registry');
