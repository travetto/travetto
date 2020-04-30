import * as child_process from 'child_process';

// TODO: Document
export function fork(cmd: string, args: string[] = [], opts: child_process.SpawnOptions = {}) {
  return new Promise<string>((resolve, reject) => {
    const text: Buffer[] = [];
    const err: Buffer[] = [];
    const proc = child_process.spawn(process.argv0, [cmd, ...args], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      shell: false,
      ...opts,
      env: {
        ...process.env,
        DEBUG: '0',
        TRACE: '0',
        ...(opts.env || {})
      }
    });
    proc.stdout!.on('data', v => text.push(v));
    proc.stderr!.on('data', v => err.push(v));
    proc.on('exit', v => {
      if (v === 0) {
        resolve(Buffer.concat(text).toString());
      } else {
        reject(Buffer.concat(err).toString());
      }
    });
  });
}