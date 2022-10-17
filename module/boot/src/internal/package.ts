import { readFileSync } from 'fs';
import { PathUtil } from '../path';

export type PackageType = {
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

export const readPackage = (folder: string): PackageType =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  JSON.parse(readFileSync(PathUtil.resolveUnix(folder, 'package.json'), 'utf8')) as PackageType;