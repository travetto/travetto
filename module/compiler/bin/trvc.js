#!/usr/bin/env node
// @ts-check
import './hook.js';
import { invoke } from '@travetto/compiler/support/operations.ts';
const [operation, ...args] = process.argv.slice(2);
invoke(operation, args);