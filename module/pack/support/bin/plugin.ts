import fs from 'fs/promises';
import { Plugin } from 'rollup';

import { path, RootIndex, MANIFEST_FILE } from '@travetto/manifest';

import { AssembleConfig } from './config';

export function travettoPlugin(config: AssembleConfig): Plugin {
  const plugin: Plugin = {
    name: 'travetto-plugin',
    async buildEnd(): Promise<void> {
      // Ensure we run cli to generate app cache
      const main = RootIndex.manifest.modules[RootIndex.manifest.mainModule];
      await fs.mkdir(path.resolve(config.dir, main.output), { recursive: true });
      await fs.writeFile(
        path.resolve(config.dir, main.output, MANIFEST_FILE),
        JSON.stringify({
          ...RootIndex.manifest, outputFolder: config.dir, modules: Object.fromEntries(
            config.modules.map(m => [m.name, m])
          )
        }),
        'utf8'
      );
    }
  };
  return plugin;
}
