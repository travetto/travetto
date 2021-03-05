#!/usr/bin/env node
const path = require('path');
require('child_process')
  .execSync(`npm run build -- ${process.argv.slice(2).join(' ')}`, {
    cwd: path.resolve(__dirname, '..', 'module/boot'),
    stdio: [0, 1, 2]
  });