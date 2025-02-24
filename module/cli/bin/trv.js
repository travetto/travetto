#!/usr/bin/env node

// @ts-check
require('@travetto/compiler/bin/entry.common.js.ts')
  .load(ops => ops.exec('@travetto/cli/support/entry.trv.js.ts'));
