import { ScanFs } from '@travetto/boot';

ScanFs.scanDirSync({ testFile: x => /^(?!index)/.test(x) }, __dirname)
  .forEach(x => require(x.file));
