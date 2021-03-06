import * as fs from 'fs';
import { PathUtil, ScanFs } from '@travetto/boot';

export async function processServiceConfigs(svc: string) {
  const svcConfigs = await ScanFs.scanDir({ testFile: f => new RegExp(`${svc}.*[.]config$/`).test(f) }, PathUtil.cwd);
  for (const conf of svcConfigs) {
    // Do work

    const contents = await fs.promises.readFile(conf.module, 'utf8');
  }
}
