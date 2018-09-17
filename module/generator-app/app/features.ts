export const FEATURES = {
  rest: {
    sub: ['express', 'koa', 'fastify'],
    addons: ['swagger', 'log'],
    context: {},
    default: 'express'
  },
  model: {
    sub: ['elasticsearch', 'mongo'],
    addons: [],
    context: {},
    default: 'mongo'
  },
};

export const pkg = (mod: string, sub: string) => ({
  [mod]: {
    packageName: sub,
    className: sub.charAt(0).toUpperCase() + sub.substring(1)
  }
});