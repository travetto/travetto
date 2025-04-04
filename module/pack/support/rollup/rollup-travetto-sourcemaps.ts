import path from 'node:path';
import fs from 'node:fs/promises';

import { LoadResult, Plugin, PluginContext } from 'rollup';

import { CoreRollupConfig } from '../../src/types.ts';

function toString(error: unknown): string {
  return error instanceof Error ? error.stack ?? error.toString() : JSON.stringify(error);
}
// Pulled from https://github.com/Azure/azure-sdk-for-js/blob/main/common/tools/dev-tool/src/config/rollup.base.config.ts#L128
export function travettoSourcemaps(config: CoreRollupConfig): Plugin {
  if (config.output.sourcemap === 'hidden' || config.output.sourcemap === false) {
    return { name: 'travetto-source-maps' };
  }
  return {
    name: 'travetto-source-maps',
    async load(this: PluginContext, id: string): Promise<LoadResult> {
      if (!id.endsWith('.js')) {
        return null;
      }
      try {
        const code = await fs.readFile(id, 'utf8');
        if (code.includes('sourceMappingURL')) {
          const mapPath = code.match(/sourceMappingURL=(.*)/)?.[1];
          if (!mapPath) {
            this.warn({ message: `Could not find map path in file ${id}`, id });
            return null;
          }
          const basePath = path.dirname(id);
          const absoluteMapPath = path.join(basePath, mapPath);
          const map = JSON.parse(await fs.readFile(absoluteMapPath, 'utf8'));
          return { code, map };
        }
        return { code, map: null };
      } catch (e) {
        this.warn({ message: toString(e), id });
        return null;
      }
    },
  };
}
