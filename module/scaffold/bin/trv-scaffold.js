#!/usr/bin/env node
// @ts-check
import { delimiter } from 'node:path';
import { writeFileSync, readFileSync } from 'node:fs';

await import('@travetto/compiler/bin/hook.js');

const { invoke } = await import('@travetto/compiler/support/invoke.ts');

if (process.env.npm_lifecycle_script?.includes('trv-scaffold')) { // Is npx  run
  writeFileSync('package.json', JSON.stringify({ ...JSON.parse(readFileSync('./package.json', 'utf-8')), type: 'module' }));
  const parts = process.env.PATH?.split(delimiter) ?? [];
  const item = parts.find(part => part.includes('npx') && part.includes('.bin'));
  if (item) {
    process.chdir(item.split('/node_modules')[0]);
  }
}

await invoke('exec', ['@travetto/cli/support/entry.trv.js', 'scaffold', '-c', process.cwd(), ...process.argv.slice(2)]);