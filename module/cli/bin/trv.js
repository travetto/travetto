#!/usr/bin/env node

globalThis.__entry_point__ = __filename;

// @ts-check
require('@travetto/compiler/bin/entry.common.js')
  .load(operations => operations.exec('@travetto/cli/support/entry.trv.js'));
