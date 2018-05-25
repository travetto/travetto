#!/usr/bin/env node

require('../bin/travetto').run().then(async () => {
  const { rimraf } = require('../src/scan-fs');

  try {
    await rimraf(process.env.TS_CACHE_DIR);
    console.log('Deleted build/');
  } catch (e) {
    console.log('Failed in deleting');
  }
});