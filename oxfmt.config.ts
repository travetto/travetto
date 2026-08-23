import { oxfmtConfig } from './module/lint/support/oxfmt.ts';

export default oxfmtConfig({
  ignorePatterns: [
    'archived/**',
    'notes/**',
    'related/travetto.github.io/**'
  ]
});
