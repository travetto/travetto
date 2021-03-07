#!/usr/bin/env node
const sym = Symbol.for('@trv:boot/register');
if (!global[sym]) {
  global[sym] = true;
  try {
    require(`${process.cwd()}/.env`);
  } catch { }

  for (const req of (process.env.TRV_REQUIRES || '').split(',')) {
    req && require(req);
  }

  require('@travetto/boot/src/internal').CompileUtil.init();
}