import * as fs from 'fs';

let pkg = JSON.parse(fs.readFileSync(process.cwd() + '/package.json').toString());
const ENV_MAP =
  (['ENV', 'env', 'DEFAULT_ENV']
    .map(x => process.env[x])
    .find(x => !!x) || 'dev')
    .toLowerCase()
    .split(/[, ]+/)
    .reduce(
    (acc, e) => (acc[e] = true) && acc,
    { application: true } as { [key: string]: boolean })

const dev = ENV_MAP.dev || ENV_MAP.test;

export const AppInfo = {
  VERSION: pkg.version,
  NAME: pkg.name,
  SIMPLE_NAME: pkg.name.replace(/[@]/g, '').replace(/[\/]/g, '_'),
  LICENSE: pkg.license,
  AUTHOR: pkg.author,
  DESCRIPTION: pkg.description,
  ENV: ENV_MAP,
  WATCH_MODE: ENV_MAP.dev && !process.env.NO_WATCH
};