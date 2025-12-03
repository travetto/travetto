import { existsSync, readFileSync } from 'node:fs';

import { configs } from '@eslint/js';
import tsEslintPlugin from '@typescript-eslint/eslint-plugin';
import stylisticPlugin from '@stylistic/eslint-plugin';
import unusedImports from 'eslint-plugin-unused-imports';

import { Runtime } from '@travetto/runtime';

import { IGNORES, GLOBALS, TS_OPTIONS } from './eslint-common.ts';
import { STD_RULES } from './eslint-std-rules.ts';
import { TrvEslintPlugin } from './types.ts';

export function buildConfig(pluginMaps: Record<string, TrvEslintPlugin>[]): readonly unknown[] {
  const plugins: TrvEslintPlugin[] = pluginMaps.map(Object.values).flat();
  const pluginRules: Record<string, TrvEslintPlugin['rules'][string]['defaultLevel']> = {};
  for (const { name, rules } of plugins) {
    for (const ruleName of Object.keys(rules)) {
      pluginRules[`${name}/${ruleName}`] = rules[ruleName].defaultLevel ?? 'error';
    }
  }

  const overrides = Runtime.workspaceRelative('eslint-overrides.json');

  const extra: (typeof STD_RULES)[] = existsSync(overrides) ? JSON.parse(readFileSync(overrides, 'utf8')) : [];

  const result = [
    configs.recommended,
    { ignores: IGNORES, },
    {
      ...TS_OPTIONS,
      files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'],
      plugins: {
        '@stylistic': {
          rules: stylisticPlugin.rules
        },
        '@typescript-eslint': {
          rules: tsEslintPlugin.rules,
        },
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
      },
      rules: {
        ...Object.fromEntries(Object.entries(STD_RULES).filter(rule => !rule[0].startsWith('@typescript'))),
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

  return result;
}