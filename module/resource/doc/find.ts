import * as fs from 'fs/promises';

import { ScanFs } from '@travetto/base';

export async function processServiceConfigs(svc: string) {
  const svcConfigs = await ScanFs.scanDir({ testFile: f => new RegExp(`${svc}.*[.]config$/`).test(f) });
  for (const conf of svcConfigs) {
    // Do work

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const contents = await fs.readFile(conf.module, 'utf8');
  }
}
