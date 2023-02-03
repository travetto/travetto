import fs from 'fs/promises';
import { Plugin } from 'rollup';

import { path, RootIndex, MANIFEST_FILE } from '@travetto/manifest';

import { AssembleConfig } from './config';

async function writeRawFile(file: string, contents: string, mode?: string): Promise<void> {
  await fs.writeFile(file, contents, { encoding: 'utf8', mode });
}

export function travettoPlugin(config: AssembleConfig): Plugin {
  const plugin: Plugin = {
    name: 'travetto-plugin',
    async buildStart(): Promise<void> {
      await fs.rm(config.output, { recursive: true });
    },
    async buildEnd(): Promise<void> {
      // Ensure we run cli to generate app cache
      for (const mod of config.modules) {
        if (mod.main || mod.name === '@travetto/manifest') {
          await fs.mkdir(path.resolve(config.output, mod.output), { recursive: true });
          await fs.copyFile(
            path.resolve(mod.output, 'package.json'),
            path.resolve(config.output, mod.output, 'package.json'),
          );
        }
      }

      const main = RootIndex.manifest.modules[RootIndex.manifest.mainModule];
      await fs.writeFile(
        path.resolve(config.output, main.output, MANIFEST_FILE),
        JSON.stringify({ ...RootIndex.manifest, outputFolder: config.output, modules: config.modules }),
        'utf8'
      );

      await writeRawFile(path.resolve(config.output, config.entryName), `#!/bin/sh\nnode ${config.entryFile} $@\n`, '755');
      await writeRawFile(path.resolve(config.output, `${config.entryName}.cmd`), `node ${config.entryFile} %*\n`, '755');

      const resources = main.files.resources ?? [];
      for (const [el] of resources) {
        const dest = path.resolve(config.output, el);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(path.resolve(main.source, el), dest);
      }

      await config.postBuild?.(config);
    }
  };
  return plugin;
}
