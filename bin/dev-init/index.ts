import * as fs from 'fs';
import { DepResolver } from './resolver';
import { Finalize } from './finalize';
import { Util } from './util';

import { ExecUtil } from '../../module/boot/src/exec';

export async function init() {
  DepResolver.init();

  // Init lerna
  await ExecUtil.spawn('npx', ['lerna', 'clean', '--yes'], { shell: true }).result;
  await ExecUtil.spawn('npx', ['lerna', 'bootstrap', '--hoist'], { shell: true }).result;

  // Clear out package-lock
  try {
    fs.unlinkSync(`${Util.ROOT}/package-lock.json`);
  } catch (e) { }

  const lj = require('../../lerna.json');

  // Finalize all modules
  for (const dir of lj.packages.map((x: string) => x.split('/')[0])) {
    const base = `${Util.ROOT}/${dir}`;
    for (const mod of fs.readdirSync(base)) {
      Finalize.finalize(mod, base, /^(yes|1|true|on)$/.test(`${process.argv[2]}`));
    }
  }
}