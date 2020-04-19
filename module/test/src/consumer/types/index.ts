import { ScanApp } from '@travetto/base';

ScanApp.findSourceFiles(/^(?!index)/, __dirname)
  .map(x => x.file)
  .forEach(require);