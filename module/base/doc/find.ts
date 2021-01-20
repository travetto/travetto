import * as fs from 'fs';
import { SourceIndex } from '@travetto/boot';

export async function processServiceConfigs(svc: string) {
  const svcConfigs = await SourceIndex.find({ filter: new RegExp(`${svc}.*[.]config$/`) });
  for (const conf of svcConfigs) {
    // Do work

    await new Promise((res, rej) => fs.readFile(conf.module, 'utf8', (err, v) => {
      err ? rej(err) : res(v);
    })); // Read file
  }
}
