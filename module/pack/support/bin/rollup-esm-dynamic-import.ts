import { AcornNode, Plugin } from 'rollup';
import { walk } from 'estree-walker';
import MagicString from 'magic-string';

export function travettoImportPlugin(files: string[]): Plugin {
  const out: Plugin = {
    name: 'travetto-import',
    transform(code, id) {
      const parsed = this.parse(code);

      let ms: MagicString | undefined;

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

          // create magic string if it wasn't created already
          if (!ms) {
            ms = new MagicString(code);
            const imports = files
              .map(x => x.split('node_modules/').pop()!)
              .flatMap(x => x.endsWith('__index__.js') ? [
                x, x.replace('/__index__', '')
              ] : [x]);
            ms.prepend(
              `function __travettoImportRuntime__(path) {
    switch (path) {
  ${imports.map((p) => `    case '${p}': return import('${p}');`).join('\n')}
  ${`    default: return new Promise(function(resolve, reject) {
        (typeof queueMicrotask === 'function' ? queueMicrotask : setTimeout)(
          reject.bind(null, new Error("Unknown variable dynamic import: " + path))
        );
      })\n`}   }
   }\n\n`
            );
          }
          // call the runtime function instead of doing a dynamic import, the import specifier will
          // be evaluated at runtime and the correct import will be returned by the injected function
          ms.overwrite(
            impNode.start,
            impNode.start + 6,
            '__travettoImportRuntime__'
          );
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