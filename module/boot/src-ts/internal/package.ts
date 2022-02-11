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
  optionalDependencies?: Record<string, string>;
  optionalPeerDependencies?: Record<string, string>;
  docDependencies?: Record<string, string | true>;
  private?: boolean;
  publishConfig?: { access?: 'restricted' | 'public' };
};

export const readPackage = (folder: string, suppressError = false) => {
  try {
    return JSON.parse(readFileSync(PathUtil.resolveUnix(folder, 'package.json'), 'utf8')) as PackageType;
  } catch (e) {
    if (!suppressError) {
      throw e;
    } else {
      if (e instanceof Error) {
        console.warn(`Unable to locate ${folder}: ${e.message}`);
      }
      return {} as PackageType;
    }
  }
};