#!/usr/bin/env node

const { execSync } = require('child_process');
const os = require('os');
const cache = require('../src/env').AppEnv.cache;

if (cache.dir) {
  try {
    if (os.platform().startsWith('win')) {
      execSync(`del /S ${cache.dir}`, { shell: true });
    } else {
      execSync(`rm -rf ${cache.dir}`, { shell: true });
    }
    console.log(`Deleted ${cache.dir}`);
  } catch (e) {
    console.log('Failed in deleting');
  }
}