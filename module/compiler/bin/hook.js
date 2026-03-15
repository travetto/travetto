import module from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

globalThis.devProcessWarningExclusions.push((message) => message.startsWith('stripTypeScriptTypes'));

module.registerHooks({
  load: (url, context, nextLoad) => {
    if (/[.]tsx?$/.test(url)) {
      const source = readFileSync(fileURLToPath(url), 'utf8');
      return { format: 'module', source: module.stripTypeScriptTypes(source), shortCircuit: true };
    } else {
      return nextLoad(url, context);
    }
  }
});