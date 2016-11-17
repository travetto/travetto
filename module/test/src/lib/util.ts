let _beforeTest: ActionFunction[] = [];
let _beforeSuite: ActionFunction[] = [];
let _afterTest: ActionFunction[] = [];
let _afterSuite: ActionFunction[] = [];
let _beforeAll: (() => Promise<any>)[] = [];
let _readyPromise: Promise<any>;

export function declareSuite(fn: Function) {
  return function () {
    for (let f of _beforeSuite) { before(f); }
    for (let f of _beforeTest) { beforeEach(f); }
    for (let f of _afterTest) { afterEach(f); }
    for (let f of _afterSuite) { after(f); }
    fn.call(this);
  };
}

export function timeout(delay: number, fn: Function) {
  let cb = fn.toString().indexOf('(done)') >= 0;
  if (cb) {
    return function (done: Function) {
      this.timeout(delay);
      return fn.call(this, done);
    };
  } else {
    return function () {
      this.timeout(delay);
      return fn.call(this);
    };
  }
}

export function runWhenReady(run: () => any) {
  if (!_readyPromise) {
    if (_beforeAll.length) {
      _readyPromise = Promise.all(_beforeAll.map(x => x()));
    } else {
      _readyPromise = Promise.resolve();
    }
  }
  _readyPromise.then(run);
}

export const adder = <T>(arr: T[]) => (t: T) => arr.push(t);
export const beforeAll = adder(_beforeAll);
export const beforeSuite = adder(_beforeSuite);
export const beforeTest = adder(_beforeTest);
export const afterSuite = adder(_afterSuite);
export const afterTest = adder(_afterTest);