import { AcornNode, Plugin } from 'rollup';
import { walk } from 'estree-walker';
import MagicString from 'magic-string';

const BRAND = '__imp';

const DYNAMIC_IMPORT = (imports: string[]): string => `
function ${BRAND}(path) { 
  switch (path) {
    ${imports.map(p => `  case '${p}': return import('${p}');`).join('\n')}
    default: return import(path); // Fall back for built-ins
  } 
}
globalThis.${BRAND} = ${BRAND}`;

export function travettoImportPlugin(entry: string, files: string[]): Plugin {
  const imports = files
    .map(x => x.split('node_modules/').pop()!)
    .flatMap(x => x.endsWith('__index__.js') ? [x.replace('__index__.js', ''), x] : [x]);

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
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const impNode = node as AcornNode & { source?: { type: string } };
          if (impNode.type !== 'ImportExpression' || impNode.source?.type === 'Literal') {
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