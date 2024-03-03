import { spawn } from 'node:child_process';

import { ExecUtil } from '@travetto/base';

import { ServerHandle } from '../types';

type Server = { listen(port: number, hostname?: string): Listener };
type Listener = {
  on(type: 'error' | 'listening', cb: Function): Listener;
  off(type: 'error' | 'listening', cb: Function): Listener;
} & ServerHandle;

/** Net utilities */
export class RestNetUtil {

  /** Is an error an address in use error */
  static isInuseError(err: unknown): err is Error & { port: number } {
    return !!err && err instanceof Error && err.message.includes('EADDRINUSE');
  }
  /**
   * Listen for an http server to startup
   */
  static listen(server: Server, port: number, hostname?: string): Promise<ServerHandle> {
    return new Promise<ServerHandle>((resolve, reject) => {
      try {
        const handle = server.listen(port, hostname);
        handle
          .on('error', reject)
          .on('listening', () => { resolve(handle); handle.off('error', reject); });
      } catch (err) {
        reject(err);
      }
    });
  }

  /** Free port if in use */
  static async freePort(port: number): Promise<void> {
    const proc = spawn('lsof', ['-t', '-i', `tcp:${port}`]);
    const result = await ExecUtil.getResult(proc, { catch: true });
    if (!result.valid) {
      console.warn('Unable to kill process', result.stderr);
      return;
    }
    const [pid] = result.stdout.trim().split(/\n/g);
    if (pid) {
      process.kill(+pid);
    }
  }
}