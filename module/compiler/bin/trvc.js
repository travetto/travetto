#!/usr/bin/env node
// @ts-check
import '@travetto/runtime/support/patch.js';
import './hook.js';
const { invoke } = await import('@travetto/compiler/support/invoke.ts');
await invoke(...process.argv.slice(2));