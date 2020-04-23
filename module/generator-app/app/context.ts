import * as path from 'path';

import { EnvUtil } from '@travetto/boot';
import { run } from './util';

export class Context {
  cwd: string;
  app: { name: string };

  template = '';
  frameworkVersion = require('@travetto/base/package.json').version.replace(/[.]\d+$/, '.0');
  frameworkDependencies: string[] = [];
  peerDependencies: string[] = [];
  modules: Record<string, boolean> = {};

  author = {
    name: run('git config user.name') || EnvUtil.get('USER'),
    email: run('git config user.email')
  };

  constructor(public name: string) {
    this.cwd = path.resolve(process.cwd(), name);
    this.app = { name };
  }

  finalize() {
    this.modules = this.frameworkDependencies.map(x => x.split('/')[1]).reduce((acc, v) => ({ ...acc, [v]: true }), {});
  }
}