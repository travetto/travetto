import { AppEnv } from './env';
import * as fs from 'fs';
import * as path from 'path';

const FILTERS: string[] = [];

let filterRegex: RegExp = /./g;

let registered = false;

export function initStackHandler() {

  if (registered) {
    return;
  } else {
    registered = true;
  }

  Error.stackTraceLimit = 500;

  require('trace');
  const chain = require('stack-chain');

  addStackFilters(
    __filename.replace(/\.js$/, ''),
    'timers.js',
    'async_hooks',
    'module.js',
    '(native)',
    '<anonymous>',
    'source-map-support.js'
  );

  const BASE = AppEnv.cwd;

  chain.filter.attach(function (error: Error, frames: NodeJS.CallSite[]) {

    const rewrite = frames.filter(function (callSite) {
      return (callSite.getFileName() &&
        callSite.getFileName()!.indexOf(BASE) >= 0) &&
        !callSite.isNative() &&
        !callSite.isToplevel() &&
        !callSite.isEval() &&
        !filterRegex.test(callSite.toString());
    });

    // Handle broken depd
    if (rewrite.length < 3) {
      const depd = frames[0] && frames[0].getFileName() && frames[0].getFileName()!.includes(`${path.sep}depd${path.sep}`);
      // depd requires at least 3 frames
      while (rewrite.length < 3) {
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

export function addStackFilters(...names: string[]) {
  if (FILTERS) {
    FILTERS.push(...names);
    filterRegex = new RegExp(`(${names.map(x => x.replace(/[().\[\]|?]/g, z => `\\${z}`)).join('|')})`);
  }
}

export function simplifyStack(err: Error, cwd = AppEnv.cwd) {
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
    .filter(x => !/[\/]@travetto[\/](test|base|compile|registry|exec|pool)/.test(x)) // Exclude framework boilerplate
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
