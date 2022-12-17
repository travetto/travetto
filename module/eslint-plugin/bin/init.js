const path = require('path');
const out = process.env.TRV_OUTPUT = path.resolve('.trv_output');
process.env.TRV_MANIFEST = require(path.resolve('package.json')).name;
module.exports = require(path.resolve(out, 'node_modules', '@travetto/eslint-plugin/support/eslintrc')).config;