import { ScanApp } from '@travetto/base';

ScanApp.findSourceFiles(/^(?!index)/, __dirname)
  .forEach(x => require(x.file));
