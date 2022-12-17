import { ESLint, Rule } from 'eslint';

import { RootIndex } from '@travetto/manifest';

const plugins = RootIndex.findSupport({ filter: f => /support\/eslint[.]/.test(f) });

const config: ESLint.Plugin = { configs: { all: { plugins: ['@travetto'], rules: {} } }, rules: {} };

export = plugins.map(x => x.output).map<Record<string, Rule.RuleModule>>(require).reduce((acc, v, i) => {
  for (const [k, plugin] of Object.entries(v)) {
    const name = k.replace(/([a-z])([A-Z])/g, (_, a: string, b: string) => `${a}-${b}`).toLowerCase();
    const finalName = name in acc.rules! ? `${name}-${i}` : name;
    acc.rules![finalName] = plugin;
    acc.configs!.all.rules![`@travetto/${finalName}`] = 'error';
  }
  return acc;
}, config);