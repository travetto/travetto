import * as path from 'path';

import { run } from './util';

export interface Context {
  cwd: string;
  name: string;
  depVersion: string;
  author: {
    name: string;
    email: string;
  };
  template: string;
  keywords: string[];
  modules: string[];
  depList: string[];
}

export function getContext(name: string): Context {
  return {
    cwd: path.resolve(process.cwd(), name),
    name,
    depVersion: require('@travetto/base/package.json').version.replace(/[.]\d+$/, '.0'),
    author: {
      name: run('git config user.name') || process.env.USER!,
      email: run('git config user.email')
    },
    template: '',
    keywords: ['travetto'],
    modules: [],
    depList: []
  };
}