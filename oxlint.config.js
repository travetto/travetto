process.env.TRV_MANIFEST= '.trv/output/node_modules/@travetto/mono-repo';
const { oxlintConfig } = await import('.trv/output/node_modules/@travetto/lint/support/oxlint.js');
export default oxlintConfig();
