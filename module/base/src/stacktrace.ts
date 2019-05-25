import * as path from 'path';

import { FsUtil } from '@travetto/boot';
import { Env } from './env';

export class Stacktrace {

  private static filters: string[] = [];

  private static filterRegex: RegExp = /./g;

  static initHandler() {
    this.addStackFilters(
      __filename.replace(/\.js$/, ''),
      'timers.js',
      'typescript.js',
      'async_hooks',
      'module.js',
      '(native)',
      '<anonymous>',
      'source-map-support.js'
    );
  }

  static addStackFilters(...names: string[]) {
    if (this.filters) {
      this.filters.push(...names);
      this.filterRegex = new RegExp(`(${names.map(x => x.replace(/[().\[\]|?]/g, z => `\\${z}`)).join('|')})`);
    }
  }

  static filter = (line: string) => !/[\/]@travetto[\/](base|compile|registry|exec|worker|context)/.test(line);

  static simplifyStack(err: Error, filter = true): string {
    const getName = (x: string) => {
      const l = x.split(FsUtil.toUnix(Env.cwd))[1];
      if (l) {
        return l.split(/[.][tj]s/)[0];
      }
      return undefined;
    };

    let lastName: string = '';
    const body = err.stack!.replace(/\\/g, '/').split('\n')
      .filter(x => !filter || this.filter(x)) // Exclude framework boilerplate
      .reduce((acc, l) => {
        const name = getName(l);

        if (name === lastName) {
          // Do nothing
        } else {
          if (name) {
            lastName = name;
          }
          acc.push(l);
        }
        return acc;
      }, [] as string[])
      .map(x => x
        .replace(`${Env.cwd}/`, '')
        .replace(/^[\/]+/, '')
        .replace(/\bjs\b/g, (a, f) => `ts`)
      );

    if (!filter || body.length > 2) {
      return body.join('  \n');
    } else {
      return this.simplifyStack(err, false);
    }
  }
}