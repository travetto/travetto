#!/usr/bin/env node

require('../bin/travetto').run().then(async () => {
  const cache = require('../src/env').AppEnv.cache;
  const { rimraf } = require('../src/scan-fs');

  try {
    await rimraf(cache.dir);
    console.log(`Deleted ${cache.dir}/`);
  } catch (e) {
    console.log('Failed in deleting');
  }

  process.exit(0);
});