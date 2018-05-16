import { AppEnv } from './env';

import * as fs from 'fs';

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

  const BASE = process.cwd();

  const ogc = Error.captureStackTrace;
  Error.captureStackTrace = function (a: any, b) {
    ogc.call(Error, a, b);
    // Force stack analysis
    a.stack = a.stack;
  };

  chain.filter.attach(function (error: Error, frames: NodeJS.CallSite[]) {
    // Filter out traces related to this file
    const rewrite = frames.filter(function (callSite) {
      return (callSite.getFileName() &&
        callSite.getFileName()!.indexOf(BASE) >= 0) &&
        !callSite.isNative() &&
        !callSite.isToplevel() &&
        !callSite.isEval() &&
        !filterRegex.test(callSite.toString());
    });

    return rewrite;
  });
}

export function addStackFilters(...names: string[]) {
  if (FILTERS) {
    FILTERS.push(...names);
    filterRegex = new RegExp(`(${names.map(x => x.replace(/[().\[\]|?]/g, z => `\\${z}`)).join('|')})`);
  }
}

export function simplifyStack(err: Error, cwd = process.cwd()) {
  const getName = (x: string) => {
    const l = x.split(cwd)[1];
    if (l) {
      return l.split(/[.][tj]s/)[0];
    }
    return undefined;
  }

  let lastName: string = '';
  const body = err.stack!.split('\n')
    .filter(x => !/\/@travetto\/(test|base|compile|registry|exec|pool)/.test(x)) // Exclude framework boilerplate
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
    .map(x => x.replace(`${process.cwd()}/`, '')
      .replace('node_modules', 'n_m')
      .replace(/n_m\/@travetto\/([^/]+)\/src/g, (a, p) => `@trv/${p}`)
    )
    .join('  \n');

  return body;
}
