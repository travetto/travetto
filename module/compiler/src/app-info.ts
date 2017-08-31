import * as fs from 'fs';

let pkg = JSON.parse(fs.readFileSync(process.cwd() + '/package.json').toString());
const ENVS = [
  'application',
  ...  (['ENV', 'env', 'DEFAULT_ENV']
    .map(x => process.env[x])
    .find(x => !!x) || 'dev')
    .toLowerCase()
    .split(/[, ]+/)
];

const dev = ENVS.includes('dev') || ENVS.includes('test');

export const AppInfo = {
  VERSION: pkg.version,
  NAME: pkg.name,
  SIMPLE_NAME: pkg.name.replace(/[@]/g, '').replace(/[\/]/g, '_'),
  LICENSE: pkg.license,
  AUTHOR: pkg.author,
  DESCRIPTION: pkg.description,
  ENV: ENVS,
  WATCH_MODE: ENVS.includes('dev') && !process.env.NO_WATCH
};