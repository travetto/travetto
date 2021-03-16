#!/usr/bin/env node
var s = Symbol.for('@trv:boot/register');
global[s] = global[s] || (() => {
  try { require(`${process.cwd()}/.env`); } catch { } // read env
  (process.env.TRV_REQUIRES || '').split(/\s*,\s*/).forEach(x => x && require(x)); //read requires
  require('@travetto/boot/src/internal/module').ModuleManager.init() // init
})();