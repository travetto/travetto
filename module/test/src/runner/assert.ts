import * as assert from 'assert';

export class AssertUtil {
  check(name: string, ...args: any[]) {
    (assert as any)[name].apply(null, args);
  }
}