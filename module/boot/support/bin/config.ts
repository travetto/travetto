import * as path from '@travetto/path';

export const COMPILER_OUTPUT = path.resolve(process.env.TRV_COMPILER ?? '.trv_compiler');
export const SOURCE_OUTPUT = path.resolve(process.env.TRV_CACHE ?? '.trv_out');
export const STAGING_OUTPUT = path.resolve('.trv_staging');

export const NODE_VERSION = process.env.TRV_NODE_VERSION ?? process.version
  .replace(/^.*?(\d+).*?$/, (_, v) => v);

export const TS_TARGET = ({
  12: 'ES2019',
  13: 'ES2019',
  14: 'ES2020',
  15: 'ESNext',
  16: 'ESNext'
} as const)[NODE_VERSION] ?? 'ESNext'; // Default if not found

export const TSC = require.resolve('typescript').replace(/\/lib.*$/, '/bin/tsc');
