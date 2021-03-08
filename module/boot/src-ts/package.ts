import * as fs from 'fs';
import { PathUtil } from './path';

let pkg = {};
try {
  pkg = JSON.parse(fs.readFileSync(PathUtil.resolveUnix('package.json'), 'utf8'));
} catch { }

export const Package = pkg as {
  name: string;
  title?: string;
  version: string;
  description?: string;
  license?: string;
  repository?: {
    url: string;
  };
  author?: {
    email?: string;
    name?: string;
  };
  main: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};