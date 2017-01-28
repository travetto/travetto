import * as child_process from 'child_process';

export type Options = child_process.SpawnOptions & { timeout?: number };
export interface Result {
  code: number;
  stdout: string;
  stderr: string;
  message?: string;
  valid: boolean;
}
export async function run(cmd: string, options: Options = {}, kill?: (proc: child_process.ChildProcess) => Promise<void>): Promise<Result> {
  let args: string[] = [];

  let timeout = options.timeout || 15000;

  if (cmd.indexOf(' ') > 0) {
    [cmd, ...args] = cmd.split(' ');
  }

  let prom = new Promise<Result>((resolve, reject) => {
    let p = child_process.spawn(cmd, args, options);
    let stdout = '';
    let stderr = '';
    let timer: any;
    let done = false;
    let finish = async function (result: Result) {
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
      if (kill) {
        await kill(p);
      } else {
        p.kill('SIGKILL');
      }
      finish({ code: 1, stderr, stdout, message: `Execution timed out after: ${timeout} ms`, valid: false });
    }, timeout);
  });
  return prom;
}