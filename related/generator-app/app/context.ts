import * as path from 'path';

import { EnvUtil, ExecUtil } from '@travetto/boot';
import { version } from '@travetto/boot/package.json';

export class Context {
  cwd: string;
  app: { name: string };

  template = '';
  frameworkVersion = version.replace(/[.]\d+$/, '.0');
  frameworkDependencies: string[] = [];
  peerDependencies: string[] = [];
  modules: Record<string, boolean> = {};

  author = {
    name: ExecUtil.execSync('git', ['config', 'user.name']).trim() || EnvUtil.get('USER'),
    email: ExecUtil.execSync('git', ['config', 'user.email']).trim()
  };

  constructor(public name: string) {
    this.cwd = path.resolve(process.cwd(), name);
    this.app = { name };
  }

  finalize() {
    this.modules = this.frameworkDependencies.map(x => x.split('/')).reduce((acc, [, v]) => ({ ...acc, [v]: true }), {});
  }
}