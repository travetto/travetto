import { Closeable, Util } from '@travetto/base';
import { ApplicationParameter, Waitable } from './types';

/**
 * Utilities for launching applications
 */
export class AppUtil {

  /**
   * Enforces application parameter input conforms to configuration
   */
  static enforceParamType(config: ApplicationParameter, param: string) {
    try {
      switch (config.type) {
        case 'boolean': return Util.coerceType(param, Boolean);
        case 'number': return Util.coerceType(param, Number);
      }
    } catch (err) {
      throw new Error(`Invalid parameter ${config.name}: Received ${param}, but exepcted ${config.type}`);
    }
    if (config.meta?.choices && !config.meta.choices.find(c => `${c}` === param)) {
      throw new Error(`Invalid parameter ${config.name}: Received ${param} expected ${config.meta.choices.join('|')}`);
    }
    return Util.coerceType(param, String);
  }

  /**
   * Build a waitable handle
   */
  static waitHandle(): Waitable & Closeable {
    let id: NodeJS.Timeout;
    return {
      name: 'waiter',
      wait: () => new Promise(r => {
        id = setTimeout(r, Number.MAX_SAFE_INTEGER / 10 ** 7);
      }),
      close: () => id && clearTimeout(id)
    };
  }
}