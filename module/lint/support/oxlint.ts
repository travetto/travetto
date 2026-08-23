import { defineConfig, type OxlintConfig } from 'oxlint';

export const baseOxlintConfig: OxlintConfig = {
  plugins: ['typescript', 'unicorn', 'oxc'],
  categories: {
    correctness: 'error'
  },
  rules: {
    'no-var': 'error',
    'prefer-const': [
      'error',
      {
        destructuring: 'all',
        ignoreReadBeforeAssign: true
      }
    ],
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/consistent-type-imports': [
      'error',
      {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports'
      }
    ],
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/no-empty-object-type': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-wrapper-object-types': 'off',
    'no-cond-assign': 'off',
    'no-unused-expressions': 'off',
    'no-unused-private-class-members': 'off',
    'no-unassigned-vars': 'off',
    'no-useless-escape': 'off',
    'unicorn/no-useless-spread': 'off',
    'unicorn/no-useless-fallback-in-spread': 'off',
    'unicorn/prefer-string-starts-ends-with': 'off',
    'unicorn/no-new-array': 'off'
  },
  overrides: [
    {
      files: ['**/test/**', '**/support/test/**', '**/doc/**', '**/global-test/**', '**/DOC.tsx'],
      rules: {
        'prefer-const': 'off'
      }
    }
  ],
  ignorePatterns: [
    '**/node_modules/**',
    '**/.trv/**',
    '**/out/**',
    '**/ui/**',
    '**/api-client/**',
    '**/*.d.ts',
    '**/fixtures/**',
    '**/resources/**',
    '**/DOC.html',
    '**/README.md',
    '**/.vscode/**'
  ]
};

export function oxlintConfig(overrides: Partial<OxlintConfig> = {}): OxlintConfig {
  return defineConfig({
    ...baseOxlintConfig,
    ...overrides,
    rules: {
      ...baseOxlintConfig.rules,
      ...overrides.rules
    },
    ignorePatterns: [...(baseOxlintConfig.ignorePatterns ?? []), ...(overrides.ignorePatterns ?? [])],
    overrides: [...(baseOxlintConfig.overrides ?? []), ...(overrides.overrides ?? [])]
  });
}
