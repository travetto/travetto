// @ts-check

import { readFileSync } from 'node:fs';
import module from 'node:module';
import { fileURLToPath } from 'node:url';

process.setSourceMapsEnabled(true); // Ensure source map during compilation/development
process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --enable-source-maps`; // Ensure it passes to children
Error.stackTraceLimit = Number.POSITIVE_INFINITY;

const ogEmitWarning = process.emitWarning.bind(process);

module.registerHooks({
  load: (url, context, nextLoad) => {
    if (/[.]tsx?$/.test(url)) {
      const source = readFileSync(fileURLToPath(url), 'utf8');
      try {
        process.emitWarning = () => {};
        return { format: 'module', source: module.stripTypeScriptTypes(source), shortCircuit: true };
      } finally {
        process.emitWarning = ogEmitWarning;
      }
    } else {
      return nextLoad(url, context);
    }
  }
});
