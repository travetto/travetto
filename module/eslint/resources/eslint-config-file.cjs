process.env.TRV_MANIFEST = '%MANIFEST_FILE%';

const { buildConfig } = require('@travetto/eslint/support/bin/eslint-config');
const { RuntimeIndex } = require('@travetto/runtime/__index__');

const pluginFiles = RuntimeIndex.find({ folder: f => f === 'support', file: f => /support\/eslint[.]/.test(f) });
const plugins = pluginFiles.map(x => require(x.outputFile));
const config = buildConfig(plugins);

module.exports = config;