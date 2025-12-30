import { readFileSync } from 'node:fs';
import { Plugin } from 'rollup';

import { RuntimeIndex } from '@travetto/runtime';

import { CoreRollupConfig } from '../../src/types.ts';

export const GLOBAL_IMPORT = '__trv_imp';

export function travettoEntryPlugin(config: CoreRollupConfig): Plugin {
  const imports = config.files
    .map(file => file.split('node_modules/').pop()!)
    .flatMap(file => file.endsWith('/__index__.js') ? [file.replace('/__index__.js', ''), file] : [file]);

  const importer = `
function trvImp(path) {
  switch (path) {
${imports.map(file => `    case '${file}': return import('${file}')`).join('\n')}
    default: return import(path); // Fall back for built-ins
  }
}
globalThis.${GLOBAL_IMPORT} = trvImp;
`;

  const out: Plugin = {
    name: 'travetto-entry',

    intro() {
      return readFileSync(RuntimeIndex.getFromImport('@travetto/pack/support/bin/preamble.ts')!.outputFile, 'utf8')
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