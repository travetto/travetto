import * as child_process from 'child_process';
import * as net from 'net';

import { AppError } from '@travetto/base';
import { ExecutionOptions, ExecutionResult } from './types';

export class ExecUtil {
  static enhanceProcess(p: child_process.ChildProcess, options: ExecutionOptions, cmd: string) {
    const timeout = options.timeout;

    const prom = new Promise<ExecutionResult>((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let timer: any;
      let done = false;
      const finish = async function (result: ExecutionResult) {
        if (done) {
          return;
        }
        if (timer) {
          clearTimeout(timer);
        }
        done = true;

        if (!result.valid) {
          reject(new AppError(`Error executing ${cmd}: ${result.message || result.stderr || result.stdout || 'failed'}`, result));
        } else {
          resolve(result);
        }
      };

      if (!options.quiet) {
        p.stdout.on('data', (d: string) => stdout += `${d}\n`);
        p.stderr.on('data', (d: string) => stderr += `${d}\n`);
      }

      p.on('error', (err: Error) =>
        finish({ code: 1, stdout, stderr, message: err.message, valid: false }));

      p.on('close', (code: number) =>
        finish({ code, stdout, stderr, valid: code === null || code === 0 || code === 130 || code === 143 })); // Sigint/term

      if (timeout) {
        timer = setTimeout(async x => {
          if (options.timeoutKill) {
            await options.timeoutKill(p);
          } else {
            p.kill('SIGKILL');
          }
          finish({ code: 1, stderr, stdout, message: `Execution timed out after: ${timeout} ms`, valid: false, killed: true });
        }, timeout);
      }
    });

    return prom;
  }

  static spawn(cmd: string, args: string[], options: ExecutionOptions & child_process.SpawnOptions = {}) {
    args = args.map(x => `${x}`);
    const p = child_process.spawn(cmd, args, { shell: false, ...options });
    const prom = ExecUtil.enhanceProcess(p, options, `${cmd} ${args.join(' ')}`);
    return [p, prom] as [typeof p, typeof prom];
  }

  static fork(cmd: string, args: string[], options: ExecutionOptions & child_process.ForkOptions = {}) {
    args = args.map(x => `${x}`);
    const p = child_process.fork(cmd, args, options);
    const prom = ExecUtil.enhanceProcess(p, options, `${cmd} ${args.join(' ')}`);
    return [p, prom] as [typeof p, typeof prom];
  }

  static exec(cmd: string, args: string[], options: ExecutionOptions & child_process.ExecOptions = {}) {
    args = args.map(x => `${x}`);
    const cmdStr = `${cmd} ${args.join(' ')}`;
    const p = child_process.exec(cmdStr, options);
    const prom = ExecUtil.enhanceProcess(p, options, cmdStr);
    return [p, prom] as [typeof p, typeof prom];
  }

  static async waitForPort(port: number, ms = 5000) {
    const start = Date.now();
    while ((Date.now() - start) < ms) {
      try {
        await new Promise((res, rej) => {
          try {
            const sock = net.createConnection(port, 'localhost', (err: any, succ: any) => {
              if (err) {
                rej(err);
              } else {
                sock.destroy();
                res(succ);
              }
            });
            sock.on('error', rej);
          } catch (e) {
            rej(e);
          }
        });
        return;
      } catch (e) {
        await new Promise(res => setTimeout(res, 50));
      }
    }
    throw new Error('Could not acquire port');
  }
}