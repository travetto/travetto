process.env.TRV_MANIFEST = '%MANIFEST_FILE%';

const { buildConfig } = require('@travetto/eslint/support/bin/eslint-config.ts');
const { RuntimeIndex } = require('@travetto/runtime/__index__.ts');

const pluginFiles = RuntimeIndex.find({ folder: f => f === 'support', file: f => /support\/eslint[.]/.test(f.relativeFile) });
const plugins = pluginFiles.map(x => require(x.outputFile));
const config = buildConfig(plugins);

module.exports = config;