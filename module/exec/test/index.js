#!/usr/bin/env node

require('@travetto/base/main').run()
  .then(x =>
    require(process.env.SRC || './docker.ts')
  );
