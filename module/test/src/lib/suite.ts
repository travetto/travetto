import * as mocha from "mocha";

let _beforeTest: ActionFunction[] = [];
let _beforeSuite: ActionFunction[] = [];
let _afterTest: ActionFunction[] = [];
let _afterSuite: ActionFunction[] = [];

const DUMMY_ASYNC = async () => { }
const DUMMY = process.nextTick

function runOnce(fn: Function): any {
  let cb = fn.toString().indexOf('(done)') >= 0;
  let gen = fn.toString().indexOf('yield ') >= 0;
  let op = fn;

  if (gen) {
    return (done: Function) => {
      op()
        .then(() => op = DUMMY_ASYNC, () => op = DUMMY_ASYNC)
        .then(done, done)
    };
  } else if (cb) {
    return (done: Function) => { op(done); op = DUMMY; }
  } else {
    return (done: Function) => { op(); op = DUMMY; done() }
  }
}

export function suite(fn: Function) {
  for (let fn of _beforeSuite) before(fn);
  for (let fn of _beforeTest) beforeEach(fn);
  for (let fn of _afterTest) afterEach(fn);
  for (let fn of _afterSuite) after(fn);
  fn();
}

export const adder = <T>(arr: T[]) => (t: T) => arr.push(t);
export const beforeAll = (fn: ActionFunction) => _beforeSuite.push(runOnce(fn));
export const beforeSuite = adder(_beforeSuite);
export const beforeTest = adder(_beforeTest);
export const afterSuite = adder(_afterSuite);
export const afterTest = adder(_afterTest);