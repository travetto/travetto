process.env.TRV_MANIFEST = '%MANIFEST_FILE%';

const { buildConfig } = await import('@travetto/eslint/support/bin/eslint-config');
const { RuntimeIndex } = await import('@travetto/runtime/__index__');

const pluginFiles = RuntimeIndex.find({
  folder: folder => folder === 'support',
  file: file => /support\/eslint[.]/.test(file.relativeFile)
});
const plugins = await Promise.all(pluginFiles.map(plugin => import(plugin.outputFile)))
const config = buildConfig(plugins);

export default config;