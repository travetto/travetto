import { ScanApp } from '@travetto/base';

ScanApp.findFiles('.ts', /^(?!index)/, __dirname)
  .map(x => x.file)
  .forEach(require);