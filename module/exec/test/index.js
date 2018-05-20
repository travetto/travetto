#!/usr/bin/env node

require('@travetto/base/bin/travetto').run()
  .then(x =>
    require(process.env.SRC || './docker-stdin.ts')
  );