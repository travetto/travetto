import { EventEmitter } from 'node:events';

import type { Assertion, TestConfig } from '../model/test.ts';

export interface CapturedAssertion extends Partial<Assertion> {
  module?: [string, string];
  line: number;
  text: string;
  operator: string;
  unexpected?: boolean;
}

/**
 * Assertion capturer
 */
class $AssertCapture {

  #emitter = new EventEmitter();

  /**
   * Collect all events until the handler is closed
   * @param test Test to capture for
   * @param listener optional listener for events
   */
  collector(test: TestConfig, listener?: (a: Assertion) => void): () => Assertion[] {
    const assertions: Assertion[] = [];

    // Emit and collect, every assertion as it occurs
    const handler = (a: CapturedAssertion): void => {
      const asrt: Assertion = {
        ...a,
        import: a.import ?? a.module!.join('/'),
        classId: test.classId,
        methodName: test.methodName
      };
      assertions.push(asrt);
      if (listener) {
        listener(asrt);
      }
    };

    this.#emitter.on('assert', handler);

    return () => {
      this.#emitter.off('assert', handler);
      return assertions;
    };
  }

  add(a: CapturedAssertion): void {
    this.#emitter.emit('assert', a);
  }
}

export const AssertCapture = new $AssertCapture();