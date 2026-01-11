#!/usr/bin/env node
// @ts-check
import './hook.js';
const { invoke } = await import('@travetto/compiler/support/invoke.ts');
invoke();