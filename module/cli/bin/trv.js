#!/usr/bin/env node
// @ts-check
import '@travetto/compiler/bin/hook.js';
const { invoke } = await import('@travetto/compiler/support/invoke.ts');
invoke('exec', ['@travetto/cli/support/entry.trv.js', ...process.argv.slice(2)]);