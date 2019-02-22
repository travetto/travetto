import { Assertion, TestConfig } from '../model/test';
import { AssertUtil } from './util';

export class AssertCapture {

  static assertions: Assertion[] = [];
  static listener?: (a: Assertion) => void;
  static test: TestConfig;

  static start(test: TestConfig, listener?: (a: Assertion) => void) {
    this.test = test;
    this.listener = listener;
    this.assertions = [];
  }

  static add(a: Assertion) {
    this.assertions.push(a);
    if (this.listener) {
      this.listener(a);
    }
  }

  static end() {
    const ret = this.assertions;
    this.assertions = [];
    delete this.listener, this.test;
    return ret;
  }

  static buildAssertion(filename: string, text: string, operator: string) {
    const { file, line } = AssertUtil.getPositionOfError(new Error(), filename.replace(/[.][tj]s$/, ''));

    const assertion: Assertion = {
      className: this.test.className,
      methodName: this.test.methodName,
      file, line, text,
      operator,
    };

    return assertion;
  }
}