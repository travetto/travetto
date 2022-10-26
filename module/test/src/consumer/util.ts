import { ErrorUtil } from '@travetto/boot';
import { TestEvent, } from '../model/event';

export class ConsumerUtil {
  static serializeErrors(out: TestEvent): void {
    if (out.phase === 'after') {
      if (out.type === 'test') {
        if (out.test.error) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          out.test.error = ErrorUtil.serializeError(out.test.error) as Error;
        }
      } else if (out.type === 'assertion') {
        if (out.assertion.error) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          out.assertion.error = ErrorUtil.serializeError(out.assertion.error) as Error;
        }
      }
    }
  }
}