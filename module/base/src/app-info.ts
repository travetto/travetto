import { FsUtil } from '@travetto/boot';

const pkg: Record<string, string> = { name: 'untitled' };
try { Object.assign(pkg, require(FsUtil.joinUnix(FsUtil.cwd, 'package.json'))); } catch { }

/**
 * General purpose information about the application.  Derived from the app's package.json
 */
export const AppInfo = {
  version: pkg.version,
  name: pkg.name,
  simpleName: pkg.name.replace(/[@]/g, '').replace(/[\/]/g, '_'),
  package: pkg.name.split('/')[0],
  license: pkg.license,
  author: pkg.author,
  main: pkg.main,
  description: pkg.description
};