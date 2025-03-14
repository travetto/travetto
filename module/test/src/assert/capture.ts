import { EventEmitter } from 'node:events';

import { Assertion, TestConfig } from '../model/test.ts';

export interface CaptureAssert extends Partial<Assertion> {
  module?: [string, string];
  line: number;
  text: string;
  operator: string;
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
    const handler = (a: CaptureAssert): void => {
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

  add(a: CaptureAssert): void {
    this.#emitter.emit('assert', a);
  }
}

export const AssertCapture = new $AssertCapture();