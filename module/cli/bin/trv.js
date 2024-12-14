#!/usr/bin/env node

// @ts-check
require('@travetto/compiler/bin/entry.common.js')
  .load(ops => ops.exec('@travetto/cli/support/entry.trv.js'));
