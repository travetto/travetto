import { Assertion, TestConfig } from '../model/test';
import { AssertUtil } from './util';

/**
 * Assertion capturer
 */
export class AssertCapture {

  /**
   * Assertions captured so far
   */
  static assertions: Assertion[] = [];
  /**
   * Listener for captured asserts
   */
  static listener?: (a: Assertion) => void;
  /**
   * Test the asserts are for
   */
  static test: TestConfig;

  /**
   * Start capturing
   */
  static start(test: TestConfig, listener?: (a: Assertion) => void) {
    this.test = test;
    this.listener = listener;
    this.assertions = [];
  }

  /**
   * Add a new assertion
   */
  static add(a: Assertion) {
    this.assertions.push(a);
    if (this.listener) {
      this.listener(a);
    }
  }

  /**
   * Stop listening
   */
  static end() {
    const ret = this.assertions;
    this.assertions = [];
    delete this.listener, this.test;
    return ret;
  }

  /**
   * Build full assertion for a given operator
   */
  static buildAssertion(filename: string, text: string, operator: string) {
    const { file, line } = AssertUtil.getPositionOfError(new Error(), filename.replace(/[.][tj]s$/, ''));

    const assertion: Assertion = {
      classId: this.test.classId,
      methodName: this.test.methodName,
      file, line, text,
      operator,
    };

    return assertion;
  }
}