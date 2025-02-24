process.env.TRV_MANIFEST = '%MANIFEST_FILE%';

const { buildConfig } = await import('@travetto/eslint/support/bin/eslint-config.js');
const { RuntimeIndex } = await import('@travetto/runtime');

const pluginFiles = RuntimeIndex.find({ folder: f => f === 'support', file: f => /support\/eslint[.]/.test(f.relativeFile) });
const plugins = await Promise.all(pluginFiles.map(x => import(x.outputFile)))
const config = buildConfig(plugins);

export default config;