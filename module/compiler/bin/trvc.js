#!/usr/bin/env node
// @ts-check
import './hook.js';
import { Operations } from '@travetto/compiler/support/operations.ts';
const [operation, ...args] = process.argv.slice(2);
Operations.invokeCompiler(operation, args);