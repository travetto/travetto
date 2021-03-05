#!/usr/bin/env node
const path = require('path');
require('child_process')
  .execSync(`trv test:lerna ${process.argv.slice(2).join(' ')}`, {
    cwd: path.resolve(__dirname, '..', 'module/test'),
    stdio: [0, 1, 2]
  });