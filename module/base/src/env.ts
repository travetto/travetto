let e = process.env;

const envs = new Set([
  'application', ...(e.ENV || e.env || e.NODE_ENV || 'dev')
    .toLowerCase().split(/[, ]+/)
]);

const is = envs.has.bind(envs);

const prod = is('prod') || is('production');
const test = is('test') || is('testing');
const dev = !prod && !test;
const watch = dev && !('NO_WATCH' in e);

export const Env = { prod, dev, test, is, watch };

process.env.NODE_ENV = prod ? 'production' : 'development';