import { FsUtil } from '@travetto/boot';

let pkg: any = { name: 'untitled' };
try { pkg = require(FsUtil.joinUnix(FsUtil.cwd, 'package.json')); } catch { }

export const AppInfo = {
  VERSION: pkg.version,
  NAME: pkg.name,
  SIMPLE_NAME: pkg.name.replace(/[@]/g, '').replace(/[\/]/g, '_'),
  PACKAGE: pkg.name.split('/')[0],
  LICENSE: pkg.license,
  AUTHOR: pkg.author,
  MAIN: pkg.main,
  DESCRIPTION: pkg.description
};