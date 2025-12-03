process.env.TRV_MANIFEST = '%MANIFEST_FILE%';

const { buildConfig } = require('@travetto/eslint/support/bin/eslint-config');
const { RuntimeIndex } = require('@travetto/runtime/__index__');

const pluginFiles = RuntimeIndex.find({
  folder: folder => folder === 'support',
  file: file => /support\/eslint[.]/.test(file.relativeFile)
});
const plugins = pluginFiles.map(plugin => require(plugin.outputFile));
const config = buildConfig(plugins);

module.exports = config;