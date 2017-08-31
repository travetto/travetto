import * as fs from 'fs';

let pkg = JSON.parse(fs.readFileSync(process.cwd() + '/package.json').toString());
let env = (process.env.env || 'dev').toLowerCase();
const dev = env === 'dev' || env === 'test';

export const AppInfo = {
  VERSION: pkg.version,
  NAME: pkg.name,
  SIMPLE_NAME: pkg.name.replace(/[@]/g, '').replace(/[\/]/g, '_'),
  LICENSE: pkg.license,
  AUTHOR: pkg.author,
  DESCRIPTION: pkg.description,
  ENV: env,
  WATCH_MODE: env === 'dev' && !process.env.NO_WATCH
};