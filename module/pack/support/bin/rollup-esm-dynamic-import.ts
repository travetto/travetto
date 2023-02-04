import { AcornNode, Plugin } from 'rollup';
import { walk } from 'estree-walker';
import MagicString from 'magic-string';

const BRAND = '__travettoImportRuntime__';
const ERROR_STATE = 'new Promise(res => setImmediate(res)).then(() => { throw new Error("Unknown variable dynamic import: " + path); })';

const DYNAMIC_IMPORT = (imports: string[]): string => `
function ${BRAND}(path) { 
  switch (path) {
    ${imports.map(p => `  case '${p}': return import('${p}');`).join('\n')}
    default: return ${ERROR_STATE}
  } 
}
globalThis.${BRAND} = ${BRAND}`;

export function travettoImportPlugin(entry: string, files: string[]): Plugin {
  const imports = files
    .map(x => x.split('node_modules/').pop()!)
    .flatMap(x => x.endsWith('__index__.js') ? [
      x, x.replace(/\/__index__.*$/, '')
    ] : [x]);

  const out: Plugin = {
    name: 'travetto-import',
    transform(code, id) {
      const parsed = this.parse(code);

      let ms: MagicString | undefined;

      if (id.includes(entry)) {
        (ms ??= new MagicString(code).append(DYNAMIC_IMPORT(imports)));
      }

      walk(parsed, {
        enter: (node) => {
          if (node.type !== 'ImportExpression') {
            return;
          }

          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const impNode = node as AcornNode;

          const expr = code.substring(impNode.start, impNode.end);
          if ((/^['"]/.test(expr))) {
            return;
          }

          (ms ??= new MagicString(code)).overwrite(impNode.start, impNode.start + 6, BRAND);
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