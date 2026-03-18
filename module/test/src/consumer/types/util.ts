import util from 'node:util';
import { AssertionError } from 'node:assert';

import { TypedObject } from '@travetto/runtime';

export class TestConsumerUtil {
  /**
   * Convert error to string
   */
  static errorToString(error?: Error, verbose?: boolean): string | undefined {
    if (error instanceof AssertionError) {
      return;
    } else if (error instanceof Error) {
      const stack = error.stack ?
        error.stack.split(/\n/).slice(0, verbose ? -1 : 5).join('\n') :
        error.message;
      const subObject: Record<string, unknown> = {};
      for (const key of TypedObject.keys(error)) {
        if (key !== 'stack' && key !== 'message' && key !== 'name') {
          subObject[key] = error[key];
        }
      }
      return `${stack}${Object.keys(subObject).length ? `\n${util.inspect(subObject)}` : ''}`;
    } else {
      return `${error}`;
    }
  }
}