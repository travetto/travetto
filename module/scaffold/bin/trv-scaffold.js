#!/usr/bin/env node
process.env.INIT_CWD = process.cwd();
process.argv = [process.argv0, 'trv-scaffold', 'scaffold', ...process.argv.slice(2)];
require('@travetto/cli/bin/trv');