import * as child_process from 'child_process';

// CLI entry
const res = require('child_process').spawnSync(process.argv0, process.argv.slice(1), {
  argv0: process.argv0,
  cwd: process.cwd(),
  stdio: [0, 1, 2],
  shell: true,
  env: { // Handle symlinks, and denote we are in framework dev mode
    ...process.env,
    NODE_PRESERVE_SYMLINKS: '1',
    TRV_DEV: '1',
  }
});

// CLI Fork
// TODO: MOVE to boot
const fork = (cmd: string, args: string[], env: Record<string, string | undefined>) => {
  return new Promise((resolve, reject) => {
    const text: Buffer[] = [];
    const err: Buffer[] = [];
    const proc = child_process.fork(cmd, args ?? [], {
      env: { ...process.env, ...(env ?? {}) },
      cwd: FsUtil.cwd,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });
    proc.stdout!.on('data', v => text.push(v));
    proc.stderr!.on('data', v => err.push(v));
    proc.on('exit', v => {
      if (v === 0) {
        resolve(Buffer.concat(text).toString());
      } else {
        console.error(Buffer.concat(text).toString());
        reject(Buffer.concat(err).toString());
      }
    });
  });
};


/**
 * Common fork/spawn operation
 */
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