import { ShutdownManager, Util } from '@travetto/base';
import { ApplicationParameter, ApplicationHandle } from './types';

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
   * Listen for a closeable item. Returns two methods:
   * - wait (a promise result), and
   * - close Terminates the closeable
   * @param server
   */
  static listenToCloseable(server: {
    close(cb?: Function): void;
    on(type: 'close', cb: Function): void;
  }): ApplicationHandle {
    return {
      close: () => new Promise(res => server.close(res)),
      wait: () => new Promise(res => server.on('close', res))
    };
  }

  static isHandle(o: any): o is ApplicationHandle {
    return o && ('wait' in o || 'close' in o);
  }

  /**
   * Wait for a handle to finish, and close on shutdown
   */
  static async processHandle(o: ApplicationHandle) {
    // If we got back an app listener
    if ('close' in o) {
      ShutdownManager.onShutdown(__filename, () => o.close!()); // Tie shutdown into app close
    }
    if ('wait' in o) { // Wait for close signal
      await o.wait!();
    }
  }

  /**
   * Build a waitable handle
   */
  static waitHandle(): ApplicationHandle {
    let id: NodeJS.Timeout;
    return {
      wait: () => new Promise(r => {
        id = setTimeout(r, Number.MAX_SAFE_INTEGER / 10 ** 7);
      }),
      close: () => {
        if (id) {
          clearTimeout(id);
        }
      }
    };
  }
}