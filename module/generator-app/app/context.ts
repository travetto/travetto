import * as path from 'path';

import { run } from './util';

export class Context {
  cwd: string;
  app: { name: string };

  template = '';
  frameworkVersion = require('@travetto/base/package.json').version.replace(/[.]\d+$/, '.0');
  frameworkDependencies: string[] = [];
  peerDependencies: string[] = [];

  author = {
    name: run('git config user.name') || process.env.USER!,
    email: run('git config user.email')
  };

  constructor(public name: string) {
    this.cwd = path.resolve(process.cwd(), name);
    this.app = { name };
  }

  get moduleMap(): Record<string, string> {
    return this.frameworkDependencies.map(x => x.split('/')[1]).reduce((acc, v) => ({ ...acc, [v]: 1 }), {});
  }

  get modules() {
    return Object.keys(this.moduleMap || {}).sort();
  }
}