import { readFileSync } from 'fs';

import * as path from '@travetto/path';

import { version as framework } from '../package.json';
import { Package } from '../support/bin/types';
export { Package } from '../support/bin/types';

import { ModuleIndex } from './module-index';

export class PackageUtil {

  static #config: Package | undefined;

  static readPackage(folder: string): Package {
    const pkg: Package = JSON.parse(readFileSync(path.resolve(folder, 'package.json'), 'utf8'));
    return pkg;
  }

  static get main(): Package {
    if (!this.#config) {
      const { output: mainFolder } = ModuleIndex.getModule(ModuleIndex.manifest.main)!;
      try {
        this.#config = this.readPackage(mainFolder);
      } catch (err: unknown) {
        if (err instanceof Error) {
          console.warn(`Unable to locate ${path.resolve(mainFolder, 'package.json')}: ${err.message}`);
        } else {
          throw err;
        }
        this.#config = {
          name: 'untitled',
          version: '0.0.0',
          main: 'unknown',
        };
      }
      this.#config.name ??= 'untitled';
      this.#config.description ??= 'A Travetto application';
      this.#config.version ??= '0.0.0';
    }
    return this.#config;
  }

  static mainDigest(): Record<string, unknown> {
    const { main, name, author, license, version } = this.main;
    return { name, main, author, license, version, framework };
  }
}