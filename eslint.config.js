process.env.TRV_MANIFEST = './.trv/output/node_modules/@travetto/mono-repo';

const { buildConfig } = await import('./.trv/output/node_modules/@travetto/eslint/support/bin/eslint-config.js');
const { RuntimeIndex } = await import('./.trv/output/node_modules/@travetto/runtime/__index__.js');

const pluginFiles = RuntimeIndex.find({
  folder: folder => folder === 'support',
  file: file => /support\/eslint[.]/.test(file.relativeFile)
});
const plugins = await Promise.all(pluginFiles.map(plugin => import(plugin.outputFile)))
const config = buildConfig(plugins);

export default config;