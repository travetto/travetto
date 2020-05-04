import * as path from 'path';

import { EnvUtil, ExecUtil } from '@travetto/boot';

export class Context {
  cwd: string;
  app: { name: string };

  template = '';
  frameworkVersion = require('@travetto/base/package.json').version.replace(/[.]\d+$/, '.0');
  frameworkDependencies: string[] = [];
  peerDependencies: string[] = [];
  modules: Record<string, boolean> = {};

  author = {
    name: ExecUtil.execSync('git config user.name').trim() || EnvUtil.get('USER'),
    email: ExecUtil.execSync('git config user.email').trim()
  };

  constructor(public name: string) {
    this.cwd = path.resolve(process.cwd(), name);
    this.app = { name };
  }

  finalize() {
    this.modules = this.frameworkDependencies.map(x => x.split('/')[1]).reduce((acc, v) => ({ ...acc, [v]: true }), {});
  }
}