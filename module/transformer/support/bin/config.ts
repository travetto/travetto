import * as path from 'path';

export const CWD = process.cwd().replace(/[\\]/g, '/');
export const COMPILER_OUTPUT = path.resolve(CWD, process.env.TRV_COMPILER ?? '.trv_compiler');
export const SOURCE_OUTPUT = path.resolve(CWD, process.env.TRV_CACHE ?? '.trv_out');
export const STAGING_OUTPUT = path.join(CWD, '.trv_staging');

export const NODE_VERSION = process.env.TRV_NODE_VERSION ?? process.version
  .replace(/^.*?(\d+).*?$/, (_, v) => v);

export const TS_TARGET = ({
  12: 'ES2019',
  13: 'ES2019',
  14: 'ES2020',
  15: 'ESNext',
  16: 'ESNext'
})[NODE_VERSION] ?? 'ESNext'; // Default if not found

export const TSC = require.resolve('typescript').replace(/\/lib.*$/, '/bin/tsc');