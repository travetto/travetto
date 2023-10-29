#!/usr/bin/env node

// @ts-check
import { withContext } from '@travetto/compiler/bin/common.js';

withContext((ctx, compile) => compile(ctx, 'run')).then(load => load?.('@travetto/cli/support/entry.trv.js'));