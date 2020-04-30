import { Shutdown } from '@travetto/base';
import { AppListener } from './types';

// TODO: Document
export class AppUtil {
  static listenToCloseable(server: {
    close(cb?: Function): void;
    on(type: 'close', cb: Function): void;
  }): AppListener {
    return {
      kill: () => new Promise(res => server.close(res)),
      wait: () => new Promise(res => server.on('close', res))
    };
  }

  static isListener(o: any): o is AppListener {
    return o && ('wait' in o || 'kill' in o);
  }

  static async processListener(o: AppListener) {
    // If we got back an app listener
    if ('kill' in o) {
      Shutdown.onShutdown('app.listener', () => o.kill!()); // Tie shutdown into app kill
    }
    if ('wait' in o) { // Wait for close signal
      await o.wait!();
    }
  }
}