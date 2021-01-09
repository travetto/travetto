import * as fs from 'fs';
import { ScanApp } from '@travetto/base';

export async function processServiceConfigs(svc: string) {
  const svcConfigs = await ScanApp.findCommonFiles({ filter: new RegExp(`${svc}.*[.]config$/`) });
  for (const conf of svcConfigs) {
    // Do work

    await new Promise((res, rej) => fs.readFile(conf.module, 'utf8', (err, v) => {
      err ? rej(err) : res(v);
    })); // Read file
  }
}
