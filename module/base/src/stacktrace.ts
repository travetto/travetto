import { AppEnv } from './env';

const FILTERS = [
  __filename.replace(/\.js$/, ''),
  'timers.js',
  'async_hooks',
  'module.js',
  '(native)',
  '<anonymous>',
  'source-map-support.js'
]

if (!AppEnv.prod) {
  require('trace');
  const chain = require('stack-chain');
  chain.filter.attach(function (error: Error, frames: any[]) {
    // Filter out traces related to this file
    const rewrite = frames.filter(function (callSite) {
      const name: string = callSite.getFileName() || '';
      for (const f of FILTERS) {
        if (name.includes(f)) {
          return false;
        }
      }
      return true;
    });

    return rewrite;
  });
}

// Log unhandled rejections
process.on('unhandledRejection', (reason, p) => {
  console.log(reason);
});

export function addStackFilters(...names: string[]) {
  if (FILTERS) {
    FILTERS.push(...names);
  }
}