import { defineConfig, type OxfmtConfig } from 'oxfmt';

export const baseOxfmtConfig: OxfmtConfig = {
  useTabs: false,
  tabWidth: 2,
  printWidth: 140,
  singleQuote: true,
  jsxSingleQuote: false,
  quoteProps: 'as-needed',
  trailingComma: 'none',
  semi: true,
  arrowParens: 'avoid',
  bracketSameLine: false,
  bracketSpacing: true,
  sortImports: {
    newlinesBetween: true,
    customGroups: [
      {
        groupName: 'travetto-package',
        elementNamePattern: ['@travetto/*']
      },
      {
        groupName: 'travetto-subpath',
        elementNamePattern: ['@travetto/**/*.ts', '@travetto/**']
      }
    ],
    groups: ['builtin', 'external', 'travetto-package', 'travetto-subpath', ['parent', 'sibling', 'index']]
  },
  ignorePatterns: [
    '**/node_modules/**',
    '**/.trv/**',
    '**/out/**',
    '**/ui/**',
    '**/api-client/**',
    '**/*.d.ts',
    '**/*.md',
    '**/*.html',
    '**/*.yml',
    '**/*.yaml',
    '**/package.json',
    '**/package-lock.json',
    '**/fixtures/**',
    '**/resources/**',
    '**/DOC.html',
    '**/README.md',
    '**/.vscode/**'
  ]
};

export function oxfmtConfig(overrides: Partial<OxfmtConfig> = {}): OxfmtConfig {
  return defineConfig({
    ...baseOxfmtConfig,
    ...overrides,
    ignorePatterns: [...(baseOxfmtConfig.ignorePatterns ?? []), ...(overrides.ignorePatterns ?? [])],
    overrides: [...(baseOxfmtConfig.overrides ?? []), ...(overrides.overrides ?? [])]
  });
}
