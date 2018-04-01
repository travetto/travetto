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