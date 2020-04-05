import { ScanFs } from '@travetto/base';

ScanFs.scanDirSync({ testFile: x => x.endsWith('.ts') && !x.endsWith('index.ts') }, __dirname)
  .map(x => require(x.file));