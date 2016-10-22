let _beforeTest: (()=>Promise<any>)[] = [];
let _beforeSuite: ActionFunction[] = [];
let _afterTest: ActionFunction[] = [];
let _afterSuite: ActionFunction[] = [];
let _beforeAll : ActionFunction[] = [];

export function declareSuite(fn: Function) {
  return function () {
    for (let fn of _beforeSuite) before(fn);
    for (let fn of _beforeTest) beforeEach(fn);
    for (let fn of _afterTest) afterEach(fn);
    for (let fn of _afterSuite) after(fn);
    fn.call(this);
  };
}

export function timeout(delay: number, fn: Function) {
  let cb = fn.toString().indexOf('(done)') >= 0;
  if (cb) {
    return function (done: Function) {
      this.timeout(delay);
      return fn.call(this, done);
    }
  } else {
    return function () {
      this.timeout(delay);
      return fn.call(this);
    }
  }
}

export function beforeRun(run) {
  if (_beforeAll.length) {
    Promise.all(_beforeAll).then(run);
  } else {
    Process.nextTick(run);
  }
}

export const adder = <T>(arr: T[]) => (t: T) => arr.push(t);
export const beforeAll = adder(_beforeAll);
export const beforeSuite = adder(_beforeSuite);
export const beforeTest = adder(_beforeTest);
export const afterSuite = adder(_afterSuite);
export const afterTest = adder(_afterTest);