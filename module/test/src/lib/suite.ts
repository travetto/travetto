import * as mocha from "mocha";

let _beforeTest: ActionFunction[] = [];
let _beforeSuite: ActionFunction[] = [];
let _afterTest: ActionFunction[] = [];
let _afterSuite: ActionFunction[] = [];

export function suite(fn: Function) {
  return () => {
    for (let fn of _beforeSuite) before(fn);
    for (let fn of _beforeTest) beforeEach(fn);
    for (let fn of _afterTest) afterEach(fn);
    for (let fn of _afterSuite) after(fn);
    fn();
  };
}

export const adder = <T>(arr: T[]) => (t: T) => arr.push(t);
export const beforeSuite = adder(_beforeSuite);
export const beforeTest = adder(_beforeTest);
export const afterSuite = adder(_afterSuite);
export const afterTest = adder(_afterTest);