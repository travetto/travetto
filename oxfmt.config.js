process.env.TRV_MANIFEST= '.trv/output/node_modules/@travetto/mono-repo';
const { oxfmtConfig } = await import('.trv/output/node_modules/@travetto/lint/support/oxfmt.js');
export default oxfmtConfig();
