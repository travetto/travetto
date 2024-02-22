import { spawn } from 'node:child_process';
import type { Server } from 'node:http';

import { ExecUtil } from '@travetto/base';

import { ServerHandle } from '../types';

/** Net utilities */
export class RestNetUtil {

  /** Is an error an address in use error */
  static isInuseError(err: unknown): err is Error & { port: number } {
    return !!err && err instanceof Error && err.message.includes('EADDRINUSE');
  }

  /**
   * Listen for an http server to startup
   */
  static async listen(server: Server): Promise<ServerHandle> {
    await new Promise<void>((resolve, reject) =>
      server
        .on('error', reject)
        .on('listening', () => { server.off('error', reject); resolve(); })
    );
    return server;
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