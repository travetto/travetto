import { existsSync, readFileSync } from 'node:fs';

// @ts-expect-error
import unused from 'eslint-plugin-unused-imports';
import { configs } from '@eslint/js';
import tsEslintPlugin from '@typescript-eslint/eslint-plugin';

import { Runtime } from '@travetto/base';

import { IGNORES, RULE_COMMON } from './eslint-common';
import { STD_RULES } from './eslint-std-rules';
import { TrvEslintPlugin } from './types';

export function buildConfig(pluginMaps: Record<string, TrvEslintPlugin>[]): readonly unknown[] {
  const plugins: TrvEslintPlugin[] = pluginMaps.map(Object.values).flat();
  const pluginRules: Record<string, TrvEslintPlugin['rules'][string]['defaultLevel']> = {};
  for (const { name, rules } of plugins) {
    for (const ruleName of Object.keys(rules)) {
      pluginRules[`${name}/${ruleName}`] = rules[ruleName].defaultLevel ?? 'error';
    }
  }

  const overrides = Runtime.context.workspaceRelative('eslint-overrides.json');

  const extra: (typeof STD_RULES)[] = existsSync(overrides) ? JSON.parse(readFileSync(overrides, 'utf8')) : [];

  const result = [
    configs.recommended,
    { ignores: IGNORES, },
    {
      ...RULE_COMMON,
      files: ['**/*.ts', '**/*.tsx', '**/*.js'],
      plugins: {
        '@typescript-eslint': {
          rules: tsEslintPlugin.rules,
        },
        'unused-imports': {
          rules: unused.rules,
        },
        ...(Object.fromEntries(plugins.map(x => [x.name, x])))
      },
      rules: {
        ...STD_RULES,
        ...pluginRules
      }
    },
    {
      ...RULE_COMMON,
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'warn',
        'no-undef': 0,
      }
    },
    {
      ...RULE_COMMON,
      files: ['**/DOC.ts', '**/DOC.tsx', '**/doc/**/*.ts', '**/doc/**/*.tsx'],
      rules: {
        'max-len': 0,
        'no-unused-private-class-members': 0,
        '@typescript-eslint/quotes': 'warn',
        '@typescript-eslint/indent': 0,
        '@typescript-eslint/consistent-type-assertions': 0,
        '@typescript-eslint/explicit-function-return-type': 0
      }
    },
    {
      ...RULE_COMMON,
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
      ...RULE_COMMON,
      files: ['**/test/**/*.ts', '**/test/**/*.tsx', '**/support/test/**/*.ts', '**/support/test/**/*.tsx'],
      ignores: [...IGNORES, 'module/test/src/**'],
      rules: {
        '@typescript-eslint/consistent-type-assertions': 0,
        'no-unused-private-class-members': 0,
        '@typescript-eslint/explicit-function-return-type': 0
      }
    },
    ...extra.map(ex => ({
      ...RULE_COMMON,
      ...ex
    }))
  ] as const;

  return result;
}