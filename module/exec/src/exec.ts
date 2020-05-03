import { ChildProcess, fork, spawn, exec, execSync, SpawnOptions, ForkOptions, ExecOptions } from 'child_process';

import { AppError } from '@travetto/base';
import { ExecutionOptions, ExecutionResult, ExecutionState } from './types';

// TODO: Document
export class Exec {

  static enhanceProcess(p: ChildProcess, options: ExecutionOptions, cmd: string) {
    const timeout = options.timeout;

    const prom = new Promise<ExecutionResult>((resolve, reject) => {
      const stdout: string[] = [];
      const stderr: string[] = [];
      let timer: any;
      let done = false;
      const finish = function (result: Omit<ExecutionResult, 'stderr' | 'stdout'>) {
        if (done) {
          return;
        }
        if (timer) {
          clearTimeout(timer);
        }
        done = true;

        const final = {
          stdout: stdout.join('\n'),
          stderr: stderr.join('\n'),
          ...result
        };

        if (!final.valid) {
          reject(new AppError(`Error executing ${cmd}: ${final.message || final.stderr || final.stdout || 'failed'}`, 'general', final));
        } else {
          resolve(final);
        }
      };

      if (!options.quiet) {
        p.stdout!.on('data', (d: string) => stdout.push(d));
        p.stderr!.on('data', (d: string) => stderr.push(d));
      }

      p.on('error', (err: Error) =>
        finish({ code: 1, message: err.message, valid: false }));

      p.on('close', (code: number) =>
        finish({ code, valid: code === null || code === 0 || code === 130 || code === 143 })); // Sigint/term

      if (timeout) {
        timer = setTimeout(async x => {
          if (options.timeoutKill) {
            await options.timeoutKill(p);
          } else {
            p.kill('SIGKILL');
          }
          finish({ code: 1, message: `Execution timed out after: ${timeout} ms`, valid: false, killed: true });
        }, timeout);
      }
    });

    return prom;
  }

  static spawn(cmd: string, args: string[], options: ExecutionOptions & SpawnOptions = {}): ExecutionState {
    const p = spawn(cmd, args, { shell: false, ...options });
    const result = this.enhanceProcess(p, options, `${cmd} ${args.join(' ')}`);
    return { process: p, result };
  }

  static fork(cmd: string, args: string[], options: ExecutionOptions & ForkOptions = {}): ExecutionState {
    const p = fork(cmd, args, options);
    const result = this.enhanceProcess(p, options, `${cmd} ${args.join(' ')}`);
    return { process: p, result };
  }

  static exec(cmd: string, args: string[], options: ExecutionOptions & ExecOptions = {}): ExecutionState {
    const cmdStr = `${cmd} ${args.join(' ')}`;
    const p = exec(cmdStr, options);
    const result = this.enhanceProcess(p, options, cmdStr);
    return { process: p, result };
  }

  static execSync(command: string) {
    console.debug('execSync', command);
    return execSync(command, { stdio: ['pipe', 'pipe'] }).toString().trim();
  }
}