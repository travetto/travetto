import { ChildProcess, SpawnOptions, spawn, exec, execSync } from 'child_process';
import { FsUtil } from './fs';

// TODO: Document
interface ExecutionResult {
  code: number;
  stdout: string;
  stderr: string;
  message?: string;
  valid: boolean;
  killed?: boolean;
}

// TODO: Document
interface ExecutionOptions extends SpawnOptions {
  timeout?: number;
  quiet?: boolean;
  stdin?: string | Buffer | NodeJS.ReadableStream;
  timeoutKill?: (proc: ChildProcess) => Promise<void>;
}

export class ExecUtil {
  static getOpts(opts: ExecutionOptions) {
    return {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      cwd: FsUtil.cwd,
      shell: false,
      ...opts,
      env: {
        ...process.env,
        ...(opts.env ?? {})
      }
    } as ExecutionOptions;
  }

  static enhanceProcess(p: ChildProcess, options: ExecutionOptions, cmd: string) {
    const timeout = options.timeout;

    const prom = new Promise<ExecutionResult>((resolve, reject) => {
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
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
          stdout: Buffer.concat(stdout).toString('utf8'),
          stderr: Buffer.concat(stderr).toString('utf8'),
          ...result
        };

        if (!final.valid) {
          const err = new Error(`Error executing ${cmd}: ${final.message || final.stderr || final.stdout || 'failed'}`);
          (err as any).meta = final;
          reject(err);
        } else {
          resolve(final);
        }
      };

      if (!options.quiet) {
        p.stdout!.on('data', (d: string) => stdout.push(Buffer.from(d)));
        p.stderr!.on('data', (d: string) => stderr.push(Buffer.from(d)));
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

  static spawn(cmd: string, args: string[] = [], options: ExecutionOptions = {}) {
    const p = spawn(cmd, args, this.getOpts(options));
    const result = this.enhanceProcess(p, options, `${cmd} ${args.join(' ')}`);
    return { process: p, result };
  }

  static fork(cmd: string, args: string[] = [], options: ExecutionOptions = {}) {
    const p = spawn(process.argv0, [cmd, ...args], this.getOpts(options));
    const result = this.enhanceProcess(p, options, `${cmd} ${args.join(' ')}`);
    return { process: p, result };
  }

  /**
   * Execute command synchronously
   */
  static execSync(command: string) {
    console.debug('execSync', command);
    return execSync(command, { stdio: ['pipe', 'pipe'] }).toString().trim();
  }

  /**
   * Platform aware file opening
   */
  static launch(path: string) {
    const op = process.platform === 'darwin' ? 'open' :
      process.platform === 'win32' ? 'cmd /c start' :
        'xdg-open';

    exec(`${op} ${path}`);
  }
}