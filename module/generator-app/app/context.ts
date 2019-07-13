import * as path from 'path';

import { run } from './util';

export interface Context {
  cwd: string;
  app: {
    name: string;
  };
  author: {
    name: string;
    email: string;
  };
  template: string;
  modules?: string[];
  moduleMap?: Record<string, string>;
  frameworkVersion: string;
  frameworkDependencies: string[];
  peerDependencies: string[];
}

export function getContext(name: string): Context {
  return {
    cwd: path.resolve(process.cwd(), name),
    app: {
      name,
    },
    author: {
      name: run('git config user.name') || process.env.USER!,
      email: run('git config user.email')
    },
    get moduleMap() {
      return this.frameworkDependencies.map(x => x.split('/')[1]).reduce((acc, v) => ({ ...acc, [v]: 1 }), {});
    },
    get modules() {
      return Object.keys(this.moduleMap || {}).sort();
    },
    template: '',
    frameworkVersion: require('@travetto/base/package.json').version.replace(/[.]\d+$/, '.0'),
    frameworkDependencies: [],
    peerDependencies: []
  };
}