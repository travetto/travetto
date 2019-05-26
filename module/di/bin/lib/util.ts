import * as child_process from 'child_process';

import { ApplicationConfig } from '../../src/types';

export interface CachedAppConfig extends ApplicationConfig {
  appRoot: string;
  generatedTime: number;
}

export function handleFailure(err?: Error, exitCode?: number) {
  console.error(err && err.toConsole ? err : (err && err.stack ? err.stack : err));
  if (exitCode) {
    process.exit(exitCode);
  }
}

/**
 * Re-implement fork b/c the cli may not be installed, but this is used by the vscode plugin
 */
export function fork(cmd: string, args: string[] = []) {
  return new Promise<string>((resolve, reject) => {
    const text: Buffer[] = [];
    const err: Buffer[] = [];
    const proc = child_process.spawn(process.argv0, [cmd, ...args], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      shell: false
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