import fs from 'node:fs/promises';
import path from 'node:path/trv';

import { RuntimeContext, RuntimeIndex } from '@travetto/manifest';

export async function buildEslintConfig(): Promise<string> {
  const root = RuntimeIndex.getModule('@travetto/eslint')!.sourcePath;
  const ext = RuntimeContext.workspace.type === 'commonjs' ? '.cjs' : '.mjs';
  const tpl = await fs.readFile(path.resolve(root, 'resources', `eslint-config-file${ext}`), 'utf8');

  return tpl
    .replace(/'(@travetto\/[^']+)'/g, (_, v) => `'${RuntimeIndex.resolveFileImport(v)}'`)
    .replace('%MANIFEST_FILE%', RuntimeIndex.mainModule.outputPath);
}