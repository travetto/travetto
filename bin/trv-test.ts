#!/usr/bin/env node
import * as path from 'path';
import { execSync } from 'child_process';

execSync(`trv test:lerna ${process.argv.slice(2).join(' ')}`, {
  cwd: path.resolve(__dirname, '..', 'module/test'),
  stdio: [0, 1, 2]
});