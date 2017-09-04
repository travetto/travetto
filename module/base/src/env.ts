let e = process.env;

const envs = [
  'application', ...(e.ENV || e.env || e.NODE_ENV || 'dev')
    .toLowerCase().split(/[, ]+/)
];

const envSet = new Set(envs);

const is = envSet.has.bind(envSet);

const prod = is('prod') || is('production');
const test = is('test') || is('testing');
const dev = !prod && !test;
const watch = dev && !('NO_WATCH' in e);

export const AppEnv = { prod, dev, test, is, watch, all: envs };

process.env.NODE_ENV = prod ? 'production' : 'development';