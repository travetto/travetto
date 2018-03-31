import { AppEnv } from './env';

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

  chain.filter.attach(function (error: Error, frames: any[]) {
    // Filter out traces related to this file
    const rewrite = frames.filter(function (callSite) {
      const name: string = callSite.getFileName() || '';
      return !filterRegex.test(name);
    });

    return rewrite;
  });
}

export function addStackFilters(...names: string[]) {
  if (FILTERS) {
    FILTERS.push(...names);
    filterRegex = new RegExp(`(${names.join('|')})`);
  }
}