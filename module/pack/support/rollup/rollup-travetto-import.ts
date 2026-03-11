import type { AstNode, Plugin } from 'rollup';
// @ts-expect-error - This module lacks types
import { walk } from 'estree-walker';
import magicString from 'magic-string';

import { GLOBAL_IMPORT } from './rollup-travetto-entry.ts';
import type { CoreRollupConfig } from '../../src/types.ts';

type TNode = AstNode & { source?: { type: string }, callee?: TNode & { name?: string }, args?: TNode[] };

/**
 * Handles importing via non-static strings (e.g. ClassSource)
 */
export function travettoImportPlugin(config: CoreRollupConfig): Plugin {
  const fileSet = new Set(config.files);

  const out: Plugin = {
    name: 'travetto-import',

    resolveDynamicImport(specifier, _importer, _options) {
      const key = typeof specifier === 'string' ? specifier : '';
      if (config.ignore.has(key)) {
        return false;
      }
    },

    transform(code, id) {
      const parsed = this.parse(code);

      if (id.includes('support/entry') || (!fileSet.has(id) && !id.includes('@travetto'))) {
        return;
      }

      let ms: magicString | undefined;

      walk(parsed, {
        enter: (node: TNode) => {
          if (node.type === 'ImportExpression' && node.source?.type !== 'Literal') {
            if (!/["']/.test(code.substring(node.start, node.end))) {
              (ms ??= new magicString(code)).overwrite(node.start, node.start + 6, GLOBAL_IMPORT);
            }
          } else if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'require') {
            if (!/["']/.test(code.substring(node.start, node.end))) {
              (ms ??= new magicString(code)).overwrite(node.start, node.start + 7, GLOBAL_IMPORT);
            }
          }
        }
      });

      if (ms !== undefined) {
        return {
          code: ms.toString(),
          map: ms.generateMap({ file: id, includeContent: true, hires: true })
        };
      } else {
        return null;
      }
    }
  };

  return out;
}