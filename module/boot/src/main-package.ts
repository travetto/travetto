import { PackageType, readPackage } from './internal/package';
import { PathUtil } from './path';

let config: PackageType;
try {
  config = readPackage(PathUtil.cwd);
} catch (err: unknown) {
  if (err instanceof Error) {
    console.warn(`Unable to locate ${PathUtil.resolveUnix('package.json')}: ${err.message}`);
  } else {
    throw err;
  }
  config = {
    name: 'unknown',
    main: 'unknown',
    version: '0.0.0'
  };
}
export const Package: PackageType = config;