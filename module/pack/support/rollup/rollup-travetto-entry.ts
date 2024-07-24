import { readFileSync } from 'node:fs';
import { Plugin } from 'rollup';

import { RuntimeIndex } from '@travetto/base';

import { CoreRollupConfig } from '../../src/types';

export const GLOBAL_IMPORT = '__trv_imp';

export function travettoEntryPlugin(config: CoreRollupConfig): Plugin {
  const imports = config.files
    .map(x => x.split('node_modules/').pop()!)
    .flatMap(x => x.endsWith('/__index__.js') ? [x.replace('/__index__.js', ''), x] : [x]);

  const op = config.output.format === 'module' ? 'import' : 'require';
  const importer = `
function trvImp(path) {
  switch (path) {
${imports.map(x => `    case '${x}': return ${op}('${x}')`).join('\n')}
    default: return ${op}(path); // Fall back for built-ins
  }
}
globalThis.${GLOBAL_IMPORT} = trvImp;
`;

  const out: Plugin = {
    name: 'travetto-entry',

    intro() {
      return readFileSync(RuntimeIndex.getFromImport('@travetto/pack/support/bin/preamble')!.outputFile, 'utf8')
        .replaceAll('%%ENV_FILE%%', config.envFile ?? '')
        .replace(/\/\/# source.*$/m, '');
    },

    load(id) {
      if (id.endsWith(config.entry)) {
        return `${importer}${readFileSync(id, 'utf8')}`;
      }
    }
  };

  return out;
}