import { oxlintConfig } from '@travetto/lint/support/oxlint.ts';

export default oxlintConfig({
  ignorePatterns: [
    'archived/**',
    'related/travetto.github.io/**'
  ]
});
