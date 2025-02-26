import { AstNode, Plugin } from 'rollup';
import { walk } from 'estree-walker';
import magicString from 'magic-string';

import { GLOBAL_IMPORT } from './rollup-travetto-entry.ts';
import { CoreRollupConfig } from '../../src/types.ts';

type TNode = AstNode & { source?: { type: string }, callee?: TNode & { name?: string }, args?: TNode[] };

export function travettoImportPlugin(config: CoreRollupConfig): Plugin {
  const fileSet = new Set(config.files);

  const out: Plugin = {
    name: 'travetto-import',

    resolveDynamicImport(specifier, importer, options) {
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
        enter: (node) => {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const impNode = node as TNode;
          if (impNode.type === 'ImportExpression' && impNode.source?.type !== 'Literal') {
            if (!/["']/.test(code.substring(impNode.start, impNode.end))) {
              (ms ??= new magicString(code)).overwrite(impNode.start, impNode.start + 6, GLOBAL_IMPORT);
            }
          } else if (impNode.type === 'CallExpression' && impNode.callee?.type === 'Identifier' && impNode.callee.name === 'require') {
            if (!/["']/.test(code.substring(impNode.start, impNode.end))) {
              (ms ??= new magicString(code)).overwrite(impNode.start, impNode.start + 7, GLOBAL_IMPORT);
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