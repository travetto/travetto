import { ESLint } from 'eslint';
import fs from 'fs';
import Module from 'module';

import { path, RootIndex } from '@travetto/manifest';

declare module 'module' {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  function _resolveFilename(rel: string, ...args: unknown[]): string;
}

const og = Module._resolveFilename.bind(Module);
// Hack Node module system to recognize all local plugins.
Module._resolveFilename = (r, ...args): string =>
  (r.includes('eslint') && !!(RootIndex.getEntry(r) || RootIndex.getModule(r)) && !r.startsWith(RootIndex.manifest.workspacePath)) ?
    require.resolve(path.resolve(RootIndex.outputRoot, 'node_modules', r)) :
    og(r, ...args);

const readConfig = (file: string, module?: string): ESLint.ConfigData =>
  JSON.parse(fs.readFileSync(path.resolve(RootIndex.getModule(module ?? RootIndex.mainModule.name)!.source, file), 'utf8'));

export const config = readConfig('support/rules.json', '@travetto/eslint-plugin');