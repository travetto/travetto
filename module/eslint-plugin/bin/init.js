const path = require('path');
process.env.TRV_MANIFEST = path.resolve('.trv_output', 'node_modules', require(path.resolve('package.json')).name);
module.exports = require(path.resolve('.trv_output', 'node_modules', '@travetto/eslint-plugin/support/eslintrc')).config;