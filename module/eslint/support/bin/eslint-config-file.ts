import fs from 'node:fs/promises';
import path from 'node:path';

import { Runtime, RuntimeIndex } from '@travetto/runtime';

export async function buildEslintConfig(): Promise<string> {
  const root = RuntimeIndex.getModule('@travetto/eslint')!.sourcePath;
  const ext = Runtime.workspace.type === 'commonjs' ? '.cjs' : '.mjs';
  const tpl = await fs.readFile(path.resolve(root, 'resources', `eslint-config-file${ext}`), 'utf8');

  // Get path to repo-root output
  const outputPath = path.join(
    Runtime.workspace.path,
    RuntimeIndex.manifest.build.outputFolder,
    'node_modules',
    Runtime.workspace.name
  );

  return tpl
    .replace(/'(@travetto\/[^']+)'/g, (_, v) => `'${RuntimeIndex.resolveFileImport(v)}'`)
    .replace('%MANIFEST_FILE%', outputPath);
}