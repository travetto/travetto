import { readFileSync } from 'fs';

import * as path from '@travetto/path';

import { version as framework } from '../package.json';

export type Package = {
  name: string;
  displayName?: string;
  version: string;
  description?: string;
  license?: string;
  repository?: {
    url: string;
    directory?: string;
  };
  author?: {
    email?: string;
    name?: string;
  };
  main: string;
  homepage?: string;
  files?: string[];
  bin?: Record<string, string>;
  scripts?: Record<string, string>;
  engines?: Record<string, string>;
  keywords?: string[];

  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  optionalDependencies?: Record<string, string>;
  trvDependencies?: Record<string, ('doc' | 'test' | 'all')[]>;
  private?: boolean;
  publishConfig?: { access?: 'restricted' | 'public' };
};

export class PackageUtil {

  static #config: Package | undefined;

  static readPackage(folder: string): Package {
    const pkg: Package = JSON.parse(readFileSync(path.resolve(folder, 'package.json'), 'utf8'));
    return pkg;
  }

  static get main(): Package {
    if (!this.#config) {
      try {
        this.#config = this.readPackage(path.cwd());
      } catch (err: unknown) {
        if (err instanceof Error) {
          console.warn(`Unable to locate ${path.resolve('package.json')}: ${err.message}`);
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