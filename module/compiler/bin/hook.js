import { registerHooks, stripTypeScriptTypes } from 'node:module';

process.setSourceMapsEnabled(true); // Ensure source map during compilation/development
process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --enable-source-maps --disable-warning=ExperimentalWarning`; // Ensure it passes to children

registerHooks({
  load: (url, context, nextLoad) => {
    const next = nextLoad(url, context);
    return /[.]tsx?$/.test(url) ? { ...next, source: stripTypeScriptTypes(next.source?.toString() || '') } : next;
  }
});