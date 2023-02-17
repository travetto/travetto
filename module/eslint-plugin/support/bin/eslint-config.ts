// @ts-expect-error
import * as unused from 'eslint-plugin-unused-imports';
import * as tsEslintPlugin from '@typescript-eslint/eslint-plugin';

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

  const result = [
    'eslint:recommended',
    { ignores: IGNORES, },
    {
      ...RULE_COMMON,
      files: ['**/*.ts', '**/*.js'],
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
      files: ['**/*.ts'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'warn',
        'no-undef': 0,
      }
    },
    {
      ...RULE_COMMON,
      files: ['**/DOC.ts', '**/doc/**/*.ts'],
      rules: {
        'max-len': 0,
        '@typescript-eslint/quotes': 'warn',
        '@typescript-eslint/indent': 0,
        '@typescript-eslint/consistent-type-assertions': 0,
        '@typescript-eslint/explicit-function-return-type': 0
      }
    },
    {
      ...RULE_COMMON,
      files: ['module/compiler/**/*.ts', 'module/transformer/**/*.ts', '**/support/transform*.ts', '**/support/transformer.*.ts'],
      rules: {
        'no-restricted-imports': 0
      }
    },
    {
      ...RULE_COMMON,
      files: ['**/test/**/*.ts', '**/support/test/**/*.ts'],
      rules: {
        '@typescript-eslint/consistent-type-assertions': 0,
        '@typescript-eslint/explicit-function-return-type': 0
      }
    }
  ] as const;

  return result;
}