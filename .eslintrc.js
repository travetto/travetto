const path = require('path');
const out = process.env.TRV_OUTPUT = path.resolve('.trv_output');
process.env.TRV_MANIFEST = '@travetto/mono-repo';
module.exports = require(path.resolve(out, 'node_modules', '@travetto/eslint-plugin/support/eslintrc')).config;