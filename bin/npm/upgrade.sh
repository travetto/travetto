#!/bin/sh
node -r './bin/npm/.env.js' -r './module/boot/register' -e 'require("./bin/npm/ugprade.ts").run()'