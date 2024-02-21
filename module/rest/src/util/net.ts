import { spawnSync } from 'node:child_process';
import type { Server } from 'node:http';
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
    spawnSync('/bin/sh', ['-c', `lsof -t -i tcp:${port} | xargs kill`]);
  }
}