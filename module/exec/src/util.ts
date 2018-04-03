import * as child_process from 'child_process';
import * as crossSpawn from 'cross-spawn';

export type ExecOptions = {
  timeout?: number;
  quiet?: boolean;
  timeoutKill?: (proc: child_process.ChildProcess) => Promise<void>;
};
export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
  message?: string;
  valid: boolean;
}

export function enhanceProcess(p: child_process.ChildProcess, options: ExecOptions) {
  const timeout = options.timeout || 15000;

  const prom = new Promise<ExecResult>((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timer: any;
    let done = false;
    const finish = async function (result: ExecResult) {
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

    if (!options.quiet) {
      p.stdout.on('data', (d: string) => stdout += `${d}\n`);
      p.stderr.on('data', (d: string) => stderr += `${d}\n`);
    }
    p.on('error', (err: Error) =>
      finish({ code: 1, stdout, stderr, message: err.message, valid: false })
    );
    p.on('close', (code: number) =>
      finish({ code, stdout, stderr, valid: code === 0 })
    );
    timer = setTimeout(async x => {
      if (options.timeoutKill) {
        await options.timeoutKill(p);
      } else {
        p.kill('SIGKILL');
      }
      finish({ code: 1, stderr, stdout, message: `Execution timed out after: ${timeout} ms`, valid: false });
    }, timeout);
  });

  return prom;
}

function getArgs(cmd: string) {
  let args: string[] = [];

  if (cmd.indexOf(' ') > 0) {
    [cmd, ...args] = cmd.split(' ');
  }

  console.debug('exec:', [cmd, ...args].join(' '));
  return { cmd, args };
}

export function spawn(cmdStr: string, options: child_process.SpawnOptions & ExecOptions = {}): [child_process.ChildProcess, Promise<ExecResult>] {
  const { cmd, args } = getArgs(cmdStr);
  const p = crossSpawn(cmd, args, options);
  return [p, enhanceProcess(p, options)];
}

export function fork(cmdStr: string, options: child_process.ForkOptions & ExecOptions = {}): [child_process.ChildProcess, Promise<ExecResult>] {
  const { cmd, args } = getArgs(cmdStr);
  const p = child_process.fork(cmd, args, options);
  return [p, enhanceProcess(p, options)];
}

export function exec(cmd: string, options: child_process.ExecOptions & ExecOptions = {}): [child_process.ChildProcess, Promise<ExecResult>] {
  const p = child_process.exec(cmd, options);
  return [p, enhanceProcess(p, options)];
}