import fs from 'node:fs';
import eslintJs from '@eslint/js';
import type { Linter } from 'eslint';
import tsEslintPlugin from '@typescript-eslint/eslint-plugin';
import stylisticPlugin from '@stylistic/eslint-plugin';
import unusedImports from 'eslint-plugin-unused-imports';
import importPlugin from 'eslint-plugin-import';

import { castTo, JSONUtil, Runtime, RuntimeIndex } from '@travetto/runtime';

import { IGNORES, GLOBALS, TS_OPTIONS } from './eslint-common.ts';
import { STD_RULES } from './eslint-std-rules.ts';
import type { TrvEslintPlugin } from './types.ts';

const pluginFiles = RuntimeIndex.find({
  folder: folder => folder === 'support',
  file: file => /support\/eslint[.]/.test(file.relativeFile)
});

const pluginMaps = await Promise.all(pluginFiles.map(plugin => import(plugin.outputFile)));
const plugins: TrvEslintPlugin[] = pluginMaps.map(Object.values).flat();
const pluginRules: Linter.Config['rules'] = {};

for (const plugin of plugins) {
  for (const ruleName of Object.keys(plugin.rules)) {
    pluginRules[`${plugin.name}/${ruleName}`] = plugin.rules[ruleName].defaultLevel ?? 'error';
  }
}

const overrides = Runtime.workspaceRelative('eslint-overrides.json');

const extra: (typeof STD_RULES)[] = fs.existsSync(overrides) ? JSONUtil.fromBinaryArray(fs.readFileSync(overrides)) : [];

export const rules: Linter.Config[] = [
  eslintJs.configs.recommended,
  { ignores: IGNORES, },
  {
    ...TS_OPTIONS,
    files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'],
    plugins: {
      '@stylistic': {
        rules: stylisticPlugin.rules
      },
      '@typescript-eslint': {
        rules: castTo(tsEslintPlugin.rules),
      },
      import: importPlugin,
      'unused-imports': unusedImports,
      ...(Object.fromEntries(plugins.map(plugin => [plugin.name, plugin])))
    },
    rules: {
      ...STD_RULES,
      ...pluginRules
    }
  },
  {
    languageOptions: {
      globals: GLOBALS,
      ecmaVersion: 'latest',
    },
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    plugins: {
      '@stylistic': {
        rules: stylisticPlugin.rules
      },
      'unused-imports': unusedImports,
      import: importPlugin,
    },
    rules: {
      ...Object.fromEntries(Object.entries(STD_RULES!).filter(rule => !rule[0].startsWith('@typescript'))),
    }
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'warn',
      'no-undef': 0,
    }
  },
  {
    files: ['**/DOC.ts', '**/DOC.tsx', '**/doc/**/*.ts', '**/doc/**/*.tsx'],
    rules: {
      'max-len': 0,
      'no-unused-private-class-members': 0,
      '@typescript-eslint/no-unused-vars': 0,
      '@typescript-eslint/explicit-function-return-type': 0
    }
  },
  {
    files: [
      'module/compiler/**/*.ts', 'module/transformer/**/*.ts',
      '**/support/transformer/**/*.ts', '**/support/transformer/**/*.tsx',
      '**/support/transformer.*.ts', '**/support/transformer.*.tsx',
    ],
    rules: {
      'no-restricted-imports': 0
    }
  },
  {
    files: ['**/test/**/*.ts', '**/test/**/*.tsx', '**/support/test/**/*.ts', '**/support/test/**/*.tsx'],
    ignores: [...IGNORES, 'module/test/src/**'],
    rules: {
      '@typescript-eslint/no-unused-vars': 0,
      '@typescript-eslint/explicit-function-return-type': 0
    }
  },
  ...extra.map(ex => ({
    ...TS_OPTIONS,
    ...ex
  }))
] as const;