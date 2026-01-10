#!/usr/bin/env node
// @ts-check
import '@travetto/compiler/bin/hook.js';
import { Operations } from '@travetto/compiler/support/operations.ts';
Operations.invokeModule('@travetto/cli/support/entry.trv.js');