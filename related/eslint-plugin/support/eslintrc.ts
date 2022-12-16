import fs from 'fs';
import Module from 'module';

import { path, RootIndex } from '@travetto/manifest';

type RuleStatus = 'error' | 'warn' | 'off' | 0;
type Rules = Record<string, RuleStatus | [status: RuleStatus, ...args: unknown[]]>;

type EslintConfig = {
  env: Record<string, boolean>;
  parser?: string;
  ignorePatterns?: string[];
  plugins?: string[];
  extends?: string[];
  rules: Rules;
  overrides: Record<string, {
    files: string[];
    rules: Rules;
  }>[];
};

declare module 'module' {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  function _resolveFilename(rel: string, ...args: unknown[]): string;
}

const og = Module._resolveFilename.bind(Module);
// Hack Node module system to recognize all local plugins.
Module._resolveFilename = (r, ...args): string =>
  (r.includes('eslint') && !!(RootIndex.getEntry(r) || RootIndex.getModule(r)) && !r.startsWith(RootIndex.manifest.workspacePath)) ?
    require.resolve(path.resolve(RootIndex.manifest.workspacePath, RootIndex.manifest.outputFolder, 'node_modules', r)) :
    og(r, ...args);

const readConfig = (file: string, module?: string): EslintConfig =>
  JSON.parse(fs.readFileSync(path.resolve(RootIndex.getModule(module ?? RootIndex.mainModule.name)!.source, file), 'utf8'));

const base = readConfig('support/rules.json', '@travetto/eslint-plugin');
const local = readConfig('eslint.json');

export const config = {
  ...base, ...local,
  env: { ...base.env, ...local.env },
  ignorePatterns: [...base.ignorePatterns ?? [], ...local.ignorePatterns ?? []],
  extends: [...base.extends ?? [], ...local.extends ?? []],
  plugins: [...base.plugins ?? [], ...local.plugins ?? []],
  overrides: [...base.overrides ?? [], ...local.overrides ?? []],
  rules: { ...base.rules, ...local.rules }
};