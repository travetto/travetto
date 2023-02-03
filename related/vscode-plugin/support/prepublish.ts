import fs from 'fs/promises';

import { MANIFEST_FILE, path, RootIndex } from '@travetto/manifest';
import { ExecUtil } from '@travetto/base';

const folder = RootIndex.mainModule.source;
const workspace = path.resolve(folder, '..', '..');
const out = path.resolve(folder, 'out');

const VALID_MODS = new Set(['@travetto/manifest', '@travetto/base', '@travetto/terminal', RootIndex.mainModule.name]);

export async function main(): Promise<void> {
  await fs.copyFile(path.resolve(workspace, 'LICENSE'), path.resolve(folder, 'LICENSE'));
  for (const dep of ['tslib', 'source-map-support', 'source-map', 'buffer-from']) {
    const modFolder = path.resolve(out, 'node_modules', dep);
    await fs.mkdir(modFolder, { recursive: true });
    await ExecUtil.spawn('cp', ['-r', path.resolve(workspace, 'node_modules', dep, '*'), modFolder], { shell: true }).result;
  }

  const manifest = RootIndex.manifest;
  for (const key of Object.keys(manifest.modules)) {
    if (!VALID_MODS.has(key)) {
      await fs.rm(RootIndex.getModule(key)!.output, { recursive: true });
      delete manifest.modules[key];
    }
  }

  await fs.writeFile(path.resolve(RootIndex.mainModule.output, MANIFEST_FILE), JSON.stringify(RootIndex.manifest));
}