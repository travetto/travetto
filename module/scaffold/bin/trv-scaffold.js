#!/usr/bin/env node
process.env.INIT_CWD = process.cwd();
process.chdir(__dirname.replace(/(.*)\/node_modules\/.*/, (a, b) => b));
process.argv = [process.argv0, 'trv-scaffold', 'scaffold', ...process.argv.slice(2)];
require('@travetto/cli/bin/cli').main();