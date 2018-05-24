import { execSync } from 'child_process';

const e = process.env;

const envs = [
  'application', ...(e.ENV || e.env || e.NODE_ENV || 'dev')
    .toLowerCase().split(/[, ]+/)
];

const envSet = new Set(envs);

const is: (key: string) => boolean = envSet.has.bind(envSet);

const prod = is('prod') || is('production');
const test = is('test') || is('testing');
const dev = !prod && !test;
const watch = (dev && !('NO_WATCH' in e)) || 'WATCH' in e;
const debug = 'DEBUG' in e && !!e.DEBUG;
let docker = !('NO_DOCKER' in e && !!e.NO_DOCKER);
if (docker) { // Check for docker existance
  try {
    docker = execSync('docker ps') && true;
  } catch { };
}

export const AppEnv = { prod, dev, test, is, watch, all: envs, debug, docker };