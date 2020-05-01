import { ShutdownManager, Util } from '@travetto/base';
import { ApplicationParameter, ApplicationHandle } from './types';

export class AppUtil {

  /**
   * Enforces application parameter input conforms to configuration
   */
  static enforceParamType(config: ApplicationParameter, param: string) {
    switch (config.type) {
      case 'boolean': return Util.coerceType(param, Boolean);
      case 'number': return Util.coerceType(param, Number);
      default:
        if (config.meta?.choices && !config.meta.choices.find(c => `${c}` === param)) {
          throw new Error(`Invalid parameter ${config.name}: Received ${param} expected ${config.meta.choices.join('|')}`);
        }
        return Util.coerceType(param, String);
    }
  }

  static listenToCloseable(server: {
    close(cb?: Function): void;
    on(type: 'close', cb: Function): void;
  }): ApplicationHandle {
    return {
      kill: () => new Promise(res => server.close(res)),
      wait: () => new Promise(res => server.on('close', res))
    };
  }

  static isHandle(o: any): o is ApplicationHandle {
    return o && ('wait' in o || 'kill' in o);
  }

  static async processHandle(o: ApplicationHandle) {
    // If we got back an app listener
    if ('kill' in o) {
      ShutdownManager.onShutdown('app.handle', () => o.kill!()); // Tie shutdown into app kill
    }
    if ('wait' in o) { // Wait for close signal
      await o.wait!();
    }
  }
}