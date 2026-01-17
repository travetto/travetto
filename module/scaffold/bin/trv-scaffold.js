#!/usr/bin/env node
// @ts-check
import { resolve } from 'node:path';
import { writeFileSync, readFileSync } from 'node:fs';
import '@travetto/compiler/bin/hook.js';

const current = process.cwd();

if (process.env.npm_lifecycle_script?.includes('trv-scaffold')) { // Is global run (not installed)
  const folder = import.meta.dirname.split('node_modules')[0];
  const pkg = resolve(folder, 'package.json');
  writeFileSync(pkg, JSON.stringify({ ...JSON.parse(readFileSync(pkg, 'utf-8')), type: 'module' }));
  process.chdir(folder);
}

const { invoke } = await import('@travetto/compiler/support/invoke.ts');
await invoke('exec', ['@travetto/cli/support/entry.trv.ts', 'scaffold', '-c', current, ...process.argv.slice(2)]);