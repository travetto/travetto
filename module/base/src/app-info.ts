import * as path from 'path';
import { AppEnv } from './env';

const pkg = require(path.join(AppEnv.cwd, 'package.json'));

export const AppInfo = {
  VERSION: pkg.version,
  NAME: pkg.name,
  SIMPLE_NAME: pkg.name.replace(/[@]/g, '').replace(/[\/]/g, '_'),
  PACKAGE: pkg.name.split('/')[0],
  LICENSE: pkg.license,
  AUTHOR: pkg.author,
  DESCRIPTION: pkg.description,
  DEV_PACKAGES: Object.keys(pkg.devDependencies || {})
};