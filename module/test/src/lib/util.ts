export type Promisable = (() => Promise<any>) | Promise<any>;

let _beforeTest: ActionFunction[] = [];
let _beforeSuite: ActionFunction[] = [];
let _afterTest: ActionFunction[] = [];
let _afterSuite: ActionFunction[] = [];
let _beforeAll: Promisable[] = [];
let _afterAll: Promisable[] = [];

function isPromise(x: any): x is Promise<any> {
  return x.then && x.catch;
}

function resolveAll(arr: Promisable[]) {
  return Promise.all(arr.map(x => isPromise(x) ? x : x()));
}

export function declareSuite(fn: Function) {
  return function () {
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
    return function (done?: Function) {
      this.timeout(delay);
      return fn.call(this, done) as T;
    };
  } else {
    return function () {
      this.timeout(delay);
      return fn.call(this) as T;
    };
  }
}

export function initialize() {
  before(() => resolveAll(_beforeAll));
  after(() => resolveAll(_afterAll));
}

export const adder = <T>(arr: T[]) => (t: T) => arr.push(t);
export const beforeAll = adder(_beforeAll);
export const beforeSuite = adder(_beforeSuite);
export const beforeTest = adder(_beforeTest);
export const afterSuite = adder(_afterSuite);
export const afterTest = adder(_afterTest);
export const afterAll = adder(_afterAll);