process.env.TRV_MANIFEST = './.trv/output/node_modules/@travetto/mono-repo';

const { buildConfig } = require('./.trv/output/node_modules/@travetto/eslint/support/bin/eslint-config.js');
const { RuntimeIndex } = require('./.trv/output/node_modules/@travetto/runtime/__index__.js');

const pluginFiles = RuntimeIndex.find({
  folder: folder => folder === 'support',
  file: file => /support\/eslint[.]/.test(file.relativeFile)
});
const plugins = pluginFiles.map(plugin => require(plugin.outputFile));
const config = buildConfig(plugins);

module.exports = config;