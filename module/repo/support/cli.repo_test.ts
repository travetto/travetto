import '@arcsine/nodesh';
import * as cp from 'child_process';
import * as path from 'path';

async function run(): Promise<boolean> {
  const res = cp.spawnSync('trv', [
    'test:all',
    '-m', 'scan',
    path.resolve('module'),
    path.resolve('global-test')
  ], {
    cwd: path.resolve('module/test'),
    shell: false,
    stdio: [0, 1, 2]
  });
  return !res.status || res.status === 0;
}

run();