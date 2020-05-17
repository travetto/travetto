import { FsUtil } from '@travetto/boot';

const pkg: Record<string, any> = { name: 'untitled' };
try { Object.assign(pkg, require(FsUtil.joinUnix(FsUtil.cwd, 'package.json'))); } catch { }

/**
 * General purpose information about the application.  Derived from the app's package.json
 */
export const AppInfo = {
  travetto: require('../package.json').version, // Travetto version
  version: pkg.version as string,
  name: pkg.name as string,
  license: pkg.license as string,
  author: pkg.author as { email: string, name: string },
  description: pkg.description as string || 'A Travetto application'
};