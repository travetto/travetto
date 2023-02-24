process.env.TRV_MANIFEST = './.trv_output/node_modules/@travetto/eslint';
const { buildConfig } = require('./.trv_output/node_modules/@travetto/eslint/support/bin/eslint-config.js');
const { RootIndex } = require('./.trv_output/node_modules/@travetto/manifest/__index__.js');
const pluginFiles = RootIndex.findSupport({ filter: f => /support\/eslint[.]/.test(f) });
const plugins = pluginFiles.map(x => require(x.outputFile));
const config = buildConfig(plugins);
module.exports = config;