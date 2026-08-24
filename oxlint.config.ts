const { oxlintConfig } = await import('./.trv/output/node_modules/@travetto/lint/support/oxlint.js');
export default oxlintConfig({
  ignorePatterns: ['**/ui/**', '**/api-client/**']
});
