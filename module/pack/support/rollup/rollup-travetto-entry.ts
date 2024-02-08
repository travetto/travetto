import { RuntimeIndex } from '@travetto/manifest';
import { readFileSync } from 'node:fs';

import { Plugin } from 'rollup';

export const GLOBAL_IMPORT = '__trv_imp';

export function travettoEntryPlugin(entry: string, envFile: string | undefined, files: string[]): Plugin {
  const imports = files
    .map(x => x.split('node_modules/').pop()!)
    .flatMap(x => x.endsWith('/__index__.js') ? [x.replace('/__index__.js', ''), x] : x);

  function buildImporter(op: 'require' | 'import'): string {
    return `
function trvImp(path) {
  switch (path) {
${imports.map(x => `    case '${x}': return ${op}('${x}')`).join('\n')}
    default: return ${op}(path); // Fall back for built-ins
  }
}
globalThis.${GLOBAL_IMPORT} = trvImp;`;
  }

  const out: Plugin = {
    name: 'travetto-entry',

    intro() {
      return readFileSync(RuntimeIndex.getFromImport('@travetto/pack/support/rollup/preamble')!.outputFile, 'utf8')
        .replaceAll('%%ENV_FILE%%', envFile ?? '')
        .replace(/\/\/# source.*$/m, '');
    },

    load(id) {
      if (id.endsWith(entry)) {
        const src = readFileSync(id, 'utf8');
        if (src.includes('import ')) {
          return [buildImporter('import'), src].join('\n');
        } else {
          return [buildImporter('require'), src].join('\n');
        }
      }
    }
  };

  return out;
}