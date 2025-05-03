import os from 'node:os';
import net from 'node:net';
import { spawn } from 'node:child_process';

import { ExecUtil } from '@travetto/runtime';

/** Net utilities */
export class NetUtil {

  /** Is an error an address in use error */
  static isPortUsedError(err: unknown): err is Error & { port: number } {
    return !!err && err instanceof Error && err.message.includes('EADDRINUSE');
  }

  /** Get the port process id */
  static async getPortProcessId(port: number): Promise<number | undefined> {
    const proc = spawn('lsof', ['-t', '-i', `tcp:${port}`]);
    const result = await ExecUtil.getResult(proc, { catch: true });
    const [pid] = result.stdout.trim().split(/\n/g);
    if (pid && +pid > 0) {
      return +pid;
    }
  }

  /** Free port if in use */
  static async freePort(port: number): Promise<void> {
    const pid = await this.getPortProcessId(port);
    if (pid) {
      process.kill(pid);
    }
  }

  /** Find free port */
  static async getFreePort(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      server.on('error', reject);

      server.listen({ port: 0 }, () => {
        const addr = server.address();
        if (!addr || typeof addr === 'string') {
          reject(new Error('Unable to get a free port'));
          return;
        }
        const { port } = addr;
        server.close(() => { resolve(port); });
      });
    });
  }

  /**
   * Get local address for listening
   */
  static getLocalAddress(): string {
    const useIPv4 = !![...Object.values(os.networkInterfaces())]
      .find(interfaces => interfaces?.find(nic => nic.family === 'IPv4'));

    return useIPv4 ? '0.0.0.0' : '::';
  }
}