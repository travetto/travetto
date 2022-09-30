#!/usr/bin/env node
const s = Symbol.for('@trv:boot/register');
if (global[s]) {
  console.error(`@travetto/boot was already loaded at ${global[s]} but now is trying to be loaded in ${__filename}`);
  console.error('This means you have two versions of the framework installed, which is not supported');
  process.exit(1);
}
global[s] = __filename;
try { require(`${process.cwd()}/.env`); } catch { } // read env
(process.env.TRV_REQUIRES || '').replace(/[^ ,:]+/g, f => require(f));
require('@travetto/boot/src/internal/setup');
require('@travetto/boot/src/internal/module').ModuleManager.init(); // init