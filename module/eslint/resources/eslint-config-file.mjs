process.env.TRV_MANIFEST = '%MANIFEST_FILE%';

const { buildConfig } = await import('@travetto/eslint/support/bin/eslint-config');
const { RuntimeIndex } = await import('@travetto/runtime/__index__');

const pluginFiles = RuntimeIndex.find({ folder: f => f === 'support', file: f => /support\/eslint[.]/.test(f.relativeFile) });
const plugins = await Promise.all(pluginFiles.map(x => import(x.outputFile)))
const config = buildConfig(plugins);

export default config;