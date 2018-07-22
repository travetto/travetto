import { Env } from './env';
import * as path from 'path';

export class Stacktrace {

  private static registered = false;

  private static FILTERS: string[] = [];

  private static filterRegex: RegExp = /./g;

  static initHandler() {

    if (this.registered) {
      return;
    } else {
      this.registered = true;
    }

    Error.stackTraceLimit = 500;

    require('trace');
    const chain = require('stack-chain');

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

    const BASE = Env.cwd;

    chain.filter.attach(function (error: Error, frames: NodeJS.CallSite[]) {

      const rewrite = frames.filter(function (callSite) {
        return (callSite.getFileName() &&
          callSite.getFileName()!.indexOf(BASE) >= 0) &&
          !callSite.isNative() &&
          // !callSite.isToplevel() &&
          !callSite.isEval() &&
          !Stacktrace.filterRegex.test(callSite.toString());
      });

      // Handle broken depd
      if (rewrite.length < 3) {
        const depd = frames[0] && frames[0].getFileName() && frames[0].getFileName()!.includes(`${path.sep}depd${path.sep}`);
        // depd requires at least 3 frames
        while (depd && rewrite.length < 3) {
          rewrite.push({
            isNative: () => undefined,
            isToplevel: () => undefined,
            isEval: () => undefined,
            getFileName: () => 'unknown',
            getLineNumber: () => 1,
            getColumnNumber: () => 1
          } as any);
        }
      }

      return rewrite;
    });
  }

  static addStackFilters(...names: string[]) {
    if (this.FILTERS) {
      this.FILTERS.push(...names);
      this.filterRegex = new RegExp(`(${names.map(x => x.replace(/[().\[\]|?]/g, z => `\\${z}`)).join('|')})`);
    }
  }

  static simplifyStack(err: Error, cwd = Env.cwd) {
    cwd = cwd.replace(/[\\]/g, '/');

    const getName = (x: string) => {
      const l = x.split(cwd.replace(/[\\]/g, '/'))[1];
      if (l) {
        return l.split(/[.][tj]s/)[0];
      }
      return undefined;
    };

    let lastName: string = '';
    const body = err.stack!.replace(/\\/g, '/').split('\n')
      .filter(x => !/[\/]@travetto[\/](test|base|compile|registry|exec|pool|context)/.test(x)) // Exclude framework boilerplate
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
      .map(x => x.replace(cwd, '').replace(/^[\/]+/, '')
        .replace('node_modules', 'n_m')
        .replace(/n_m[\/]@travetto[\/]([^\/]+)[\/]src/g, (a, p) => `@trv/${p}`)
      )
      .join('  \n');

    return body;
  }
}