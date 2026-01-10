#!/usr/bin/env node
// @ts-check
import './hook.js';
import { invokeCompiler } from '@travetto/compiler/support/operations.ts';
const [operation, ...args] = process.argv.slice(2);
invokeCompiler(operation, args);