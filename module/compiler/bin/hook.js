import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

process.setSourceMapsEnabled(true); // Ensure source map during compilation/development
process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --enable-source-maps --disable-warning=ExperimentalWarning`; // Ensure it passes to children

registerHooks({
  load: (url, context, nextLoad) => {
    if (/[.]tsx?$/.test(url)) {
      const source = readFileSync(fileURLToPath(url), 'utf8');
      return { format: 'module', source: stripTypeScriptTypes(source), shortCircuit: true };
    } else {
      return nextLoad(url, context);
    }
  }
});