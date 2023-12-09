import path from 'path';

import { RuntimeIndex, RuntimeManifest } from '@travetto/manifest';

export function buildEslintConfig(): string {
  const rulesImp = RuntimeIndex.resolveFileImport('@travetto/eslint/support/bin/eslint-config.ts');
  const manifestImp = RuntimeIndex.resolveFileImport('@travetto/manifest/__index__.ts');
  const manifestFile = RuntimeIndex.mainModule.outputPath;

  const common = {
    manifest: `process.env.TRV_MANIFEST = '${path.resolve(manifestFile)}'`,
    pluginFiles: "const pluginFiles = RootIndex.find({ folder: f => f === 'support', file: f => /support\\/eslint[.]/.test(f) })",
    build: 'const config = buildConfig(plugins)',
  };

  const lines = RuntimeManifest.moduleType === 'commonjs' ?
    [
      common.manifest,
      `const { buildConfig } = require('${rulesImp}')`,
      `const { RootIndex } = require('${manifestImp}')`,
      common.pluginFiles,
      'const plugins = pluginFiles.map(x => require(x.outputFile))',
      common.build,
      'module.exports = config',
      ''
    ] :
    [
      common.manifest,
      `const { buildConfig } = await import('${rulesImp}')`,
      `const { RootIndex } = await import('${manifestImp}')`,
      common.pluginFiles,
      'const plugins = await Promise.all(pluginFiles.map(x => import(x.outputFile)))',
      common.build,
      'export default config',
      ''
    ];

  return lines.join(';\n');
}