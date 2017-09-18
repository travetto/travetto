import * as child_process from 'child_process';

export type ExecOptions = child_process.SpawnOptions & {
  timeout?: number;
  exposeProcess?: boolean;
  kill?: (proc: child_process.ChildProcess) => Promise<void>;
};
export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
  message?: string;
  valid: boolean;
}

export function exec(cmd: string, options: ExecOptions & { exposeProcess: true }): [Promise<ExecResult>, child_process.ChildProcess];
export function exec(cmd: string, options?: ExecOptions): Promise<ExecResult>;
export function exec(cmd: string, options: ExecOptions = {}): Promise<ExecResult> | [Promise<ExecResult>, child_process.ChildProcess] {
  let args: string[] = [];

  let timeout = options.timeout || 15000;

  if (cmd.indexOf(' ') > 0) {
    [cmd, ...args] = cmd.split(' ');
  }

  console.debug('exec:', [cmd, ...args].join(' '));

  let p = child_process.spawn(cmd, args, options);

  let prom = new Promise<ExecResult>((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timer: any;
    let done = false;
    let finish = async function (result: ExecResult) {
      if (done) {
        return;
      }
      if (timer) {
        clearTimeout(timer);
      }
      done = true;

      if (!result.valid) {
        reject(result);
      } else {
        resolve(result);
      }
    };

    p.stdout.on('data', (d: string) => stdout += d + '\n');
    p.stderr.on('data', (d: string) => stderr += d + '\n');
    p.on('error', (err: Error) =>
      finish({ code: 1, stdout, stderr, message: err.message, valid: false })
    );
    p.on('close', (code: number) =>
      finish({ code, stdout, stderr, valid: code === 0 })
    );
    timer = setTimeout(async x => {
      if (options.kill) {
        await options.kill(p);
      } else {
        p.kill('SIGKILL');
      }
      finish({ code: 1, stderr, stdout, message: `Execution timed out after: ${timeout} ms`, valid: false });
    }, timeout);

    timer.unref();
  });
  if (options.exposeProcess) {
    return [prom, p];
  } else {
    return prom;
  }
}