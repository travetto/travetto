export const FEATURES: {
  [key: string]: {
    addons?: string[];
    sub: string[];
    external?: boolean;
    context?: Record<string, any>;
    default: string;
  } | {
    addons?: string[];
  }
} = {
  rest: {
    sub: ['express', 'koa', 'fastify'],
    addons: ['swagger', 'log'],
    default: 'express'
  },
  test: {},
  'auth-rest': {
    addons: ['rest-session']
  },
  model: {
    sub: ['elasticsearch', 'mongo', 'sql'],
    default: 'mongo'
  },
  sql: {
    sub: ['mysql', 'postgres'],
    external: true,
    default: 'mysql'
  }
};

export const pkg = (mod: string, sub: string) => ({
  [mod]: {
    packageName: sub,
    className: sub.charAt(0).toUpperCase() + sub.substring(1)
  }
});