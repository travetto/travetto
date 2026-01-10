#!/usr/bin/env node
// @ts-check
import { delimiter } from 'node:path';
import fs from 'node:fs';
import { spawn, execSync } from 'node:child_process';

let workingDirectory = process.cwd();

if (process.env.npm_lifecycle_script?.includes('trv-scaffold')) { // Is npx  run
  const parts = process.env.PATH?.split(delimiter) ?? [];
  const loc = parts.find(part => part.includes('npx') && part.includes('.bin'));
  if (loc) {
    workingDirectory = loc.split('/node_modules')[0];
  }
}

const pkg = JSON.parse(fs.readFileSync(`${workingDirectory}/package.json`, 'utf8'));
const pkgVersion = `${pkg.dependencies?.['@travetto/scaffold']}`.replace(/\d+$/, '0');

// Ensure we install the compiler first
execSync(`npm i @travetto/compiler@${pkgVersion}`, { stdio: 'pipe', cwd: workingDirectory });
spawn('npx', [
  'trvc', 'exec', '@travetto/cli/support/entry.trv.js',
  'scaffold', '-c', process.cwd(), ...process.argv.slice(2)
], {
  stdio: 'inherit',
  cwd: workingDirectory,
  env: { ...process.env, TRV_QUIET: '1', }
});