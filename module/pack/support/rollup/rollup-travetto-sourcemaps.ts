import path from 'node:path';
import fs from 'node:fs/promises';

import type { LoadResult, Plugin, PluginContext, SourceMapInput } from 'rollup';

import { JSONUtil, FileLoader } from '@travetto/runtime';

import type { CoreRollupConfig } from '../../src/types.ts';

function toString(error: unknown): string {
  return error instanceof Error ? error.stack ?? error.toString() : JSONUtil.toUTF8(error);
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
          const loader = new FileLoader([path.dirname(id)]);
          const map = await loader.readText(mapPath)
            .then(JSONUtil.fromBase64<SourceMapInput>);
          return { code, map };
        }
        return { code, map: null };
      } catch (error) {
        this.warn({ message: toString(error), id });
        return null;
      }
    },
  };
}
