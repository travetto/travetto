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
  modules: {
    list: string[],
    map: Record<string, any>
    mapKeys: string[];
  };
  dependencies: {
    version: string;
    list: string[];
  };
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
    template: '',
    modules: {
      map: { cli: 1 },
      list: ['@travetto/cli'],
      get mapKeys() {
        // tslint:disable-next-line: no-invalid-this
        return Object.keys(this.map).sort();
      }
    },
    dependencies: {
      version: require('@travetto/base/package.json').version.replace(/[.]\d+$/, '.0'),
      list: ['cli']
    }
  };
}