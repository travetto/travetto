import * as path from 'path';
import { readFileSync } from 'fs';

export type PackageShape = {
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

const readPackage = (folder: string): PackageShape =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  JSON.parse(readFileSync(path.resolve(folder, 'package.json').__posix, 'utf8')) as PackageShape;

let config: PackageShape | undefined;

export const Package = {
  get main(): PackageShape {
    if (config !== undefined) {
      return config;
    }
    try {
      return config = readPackage(process.cwd().__posix);
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.warn(`Unable to locate ${path.resolve('package.json').__posix}: ${err.message}`);
      } else {
        throw err;
      }
      return config = {
        name: 'unknown',
        main: 'unknown',
        version: '0.0.0'
      };
    }
  },
  read: readPackage
};