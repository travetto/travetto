#!/usr/bin/env node

// @ts-check
require('@travetto/compiler/bin/entry.common.js')
  .load(operations => operations.exec('@travetto/cli/support/entry.trv.js'));
