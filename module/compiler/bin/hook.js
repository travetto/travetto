import module from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import '@travetto/runtime/support/polyfill.js';

process.setSourceMapsEnabled(true); // Ensure source map during compilation/development
process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --enable-source-maps`; // Ensure it passes to children
const ogEmitWarning = process.emitWarning;
Error.stackTraceLimit = 50;

module.registerHooks({
  load: (url, context, nextLoad) => {
    if (/[.]tsx?$/.test(url)) {
      try {
        process.emitWarning = () => { }; // Suppress ts-node experimental warnings
        const source = readFileSync(fileURLToPath(url), 'utf8');
        return { format: 'module', source: module.stripTypeScriptTypes(source), shortCircuit: true };
      } finally {
        process.emitWarning = ogEmitWarning;
      }
    } else {
      return nextLoad(url, context);
    }
  }
});
