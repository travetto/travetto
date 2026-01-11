process.env.TRV_MANIFEST = './.trv/output/node_modules/@travetto/mono-repo';
const { rules } = await import('./.trv/output/node_modules/@travetto/eslint/support/bin/eslint-config.js');
export { rules as default };