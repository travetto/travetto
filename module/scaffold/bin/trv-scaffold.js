#!/usr/bin/env node
process.argv = [...process.argv.slice(0, 2), 'scaffold', ...process.argv.slice(2)];
import '@travetto/compiler/bin/trv';