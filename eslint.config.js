process.env.TRV_MANIFEST = './.trv/output/node_modules/@travetto/mono-repo';
const { buildConfig } = require('./.trv/output/node_modules/@travetto/eslint/support/bin/eslint-config.js');
const { RuntimeIndex } = require('./.trv/output/node_modules/@travetto/manifest/__index__.js');
const pluginFiles = RuntimeIndex.find({ folder: f => f === 'support', file: f => /support\/eslint[.]/.test(f) });
const plugins = pluginFiles.map(x => require(x.outputFile));
const config = buildConfig(plugins);
module.exports = config;