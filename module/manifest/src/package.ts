import { readFileSync } from 'fs';

import { Package, PackageDigest } from './types';
import { path } from './path';
import { version as framework } from '../package.json';

export class PackageUtil {

  static readPackage(folder: string): Package {
    return JSON.parse(readFileSync(path.resolve(folder, 'package.json'), 'utf8'));
  }

  static digest(pkg: Package): PackageDigest {
    const { main, name, author, license, version } = pkg;
    return { name, main, author, license, version, framework };
  }
}