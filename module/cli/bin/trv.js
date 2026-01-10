#!/usr/bin/env node
// @ts-check
import '@travetto/compiler/bin/hook.js';
import { invoke } from '@travetto/compiler/support/operations.ts';
invoke('exec', ['@travetto/cli/support/entry.trv.js', ...process.argv.slice(2)]);