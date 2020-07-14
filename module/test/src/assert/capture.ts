import { EventEmitter } from 'events';
import { Assertion, TestConfig } from '../model/test';

export interface CaptureAssert extends Partial<Assertion> {
  file: string;
  line: number;
  text: string;
  operator: string;
}

/**
 * Assertion capturer
 */
class $AssertCapture extends EventEmitter {

  /**
   * Collect all events until the handler is closed
   * @param test Test to capture for
   * @param listener optional listener for events
   */
  collector(test: TestConfig, listener?: (a: Assertion) => void) {
    const assertions: Assertion[] = [];

    // Emit and collect, every assertion as it occurs
    const handler = (a: CaptureAssert) => {
      const assrt = {
        ...a,
        classId: test.classId,
        methodName: test.methodName
      };
      assertions.push(assrt);
      if (listener) {
        listener(assrt);
      }
    };

    this.on('assert', handler);

    return () => {
      this.off('assert', handler);
      return assertions;
    };
  }


  add(a: CaptureAssert) {
    return super.emit('assert', a);
  }
}

export const AssertCapture = new $AssertCapture();