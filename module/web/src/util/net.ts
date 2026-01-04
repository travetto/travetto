import os from 'node:os';
import net from 'node:net';
import { spawn } from 'node:child_process';

import { ExecUtil } from '@travetto/runtime';

/** Net utilities */
export class NetUtil {

  /** Is an error an address in use error */
  static isPortUsedError(error: unknown): error is Error & { port: number } {
    return !!error && error instanceof Error && error.message.includes('EADDRINUSE');
  }

  /** Get the port process id */
  static async getPortProcessId(port: number): Promise<number | undefined> {
    const subProcess = spawn('lsof', ['-t', '-i', `tcp:${port}`]);
    const result = await ExecUtil.getResult(subProcess, { catch: true });
    const [processId] = result.stdout.trim().split(/\n/g);
    if (processId && +processId > 0) {
      return +processId;
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
      .find(interfaces => interfaces?.find(item => item.family === 'IPv4'));

    return useIPv4 ? '0.0.0.0' : '::';
  }

  /**
   * Free a port if it is in use, typically used to resolve port conflicts.
   * @param error The error that may indicate a port conflict
   * @returns Returns true if the port was freed, false if not handled
   */
  static async freePortOnConflict(error: unknown): Promise<{ processId?: number, port: number } | undefined> {
    if (this.isPortUsedError(error)) {
      const processId = await this.getPortProcessId(error.port);
      if (processId) {
        process.kill(processId);
        return { processId, port: error.port };
      } else {
        return { port: error.port };
      }
    }
  }
}