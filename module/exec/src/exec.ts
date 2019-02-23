import * as child_process from 'child_process';

import { AppError } from '@travetto/base';
import { ExecutionOptions, ExecutionResult, ExecutionState } from './types';

export class Exec {

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

  static spawn(cmd: string, args: string[], options: ExecutionOptions & child_process.SpawnOptions = {}): ExecutionState {
    args = args.map(x => `${x}`);
    const p = child_process.spawn(cmd, args, { shell: false, ...options });
    const result = Exec.enhanceProcess(p, options, `${cmd} ${args.join(' ')}`);
    return { process: p, result };
  }

  static fork(cmd: string, args: string[], options: ExecutionOptions & child_process.ForkOptions = {}): ExecutionState {
    args = args.map(x => `${x}`);
    const p = child_process.fork(cmd, args, options);
    const result = Exec.enhanceProcess(p, options, `${cmd} ${args.join(' ')}`);
    return { process: p, result };
  }

  static exec(cmd: string, args: string[], options: ExecutionOptions & child_process.ExecOptions = {}): ExecutionState {
    args = args.map(x => `${x}`);
    const cmdStr = `${cmd} ${args.join(' ')}`;
    const p = child_process.exec(cmdStr, options);
    const result = Exec.enhanceProcess(p, options, cmdStr);
    return { process: p, result };
  }

  static execSync(command: string) {
    console.debug('execSync', command);
    return child_process.execSync(command, { stdio: ['pipe', 'pipe'] }).toString().trim();
  }
}