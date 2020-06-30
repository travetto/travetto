import * as fs from 'fs';
import { DepResolver } from './resolver';
import { Finalize } from './finalize';

import { ExecUtil } from '../../module/boot/src/exec';

export async function run() {
  DepResolver.init();

  // Init lerna
  await ExecUtil.spawn('npx', ['lerna', 'clean', '--yes'], { shell: true }).result;
  await ExecUtil.spawn('npx', ['lerna', 'bootstrap', '--hoist'], { shell: true }).result;

  // Clear out package-lock
  try {
    fs.unlinkSync(`${Finalize.ROOT}/package-lock.json`);
  } catch (e) { }

  const lj = require('../../lerna.json') as { packages: string[] };

  // Finalize all modules
  for (const dir of lj.packages.map(x => x.split('/')[0])) {
    const base = `${Finalize.ROOT}/${dir}`;
    for (const mod of fs.readdirSync(base)) {
      Finalize.finalize(mod, base);
    }
  }
  await ExecUtil.spawn('npm', ['i'], { shell: true, cwd: `${Finalize.ROOT}/related/vscode-plugin` }).result.catch(err => { });
  Finalize.finalize('vscode-plugin', 'related');
}