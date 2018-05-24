#!/usr/bin/env node

require('../bin/travetto').run().then(async () => {
  const { rimraf } = require('../src/scan-fs');

  try {
    await rimraf(`${process.env.INIT_CWD || process.cwd()}/build`)
    console.log('Deleted build/');
  } catch (e) {
    console.log('Failed in deleting');
  }
});