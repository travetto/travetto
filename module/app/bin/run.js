/**
 * @param {string} name
 */
async function run(name) {
  (await import('@travetto/base/support/init.js')).init();
  const { defineGlobalEnv } = await import('@travetto/base');
  defineGlobalEnv({});
  const { AppRunUtil } = await import('../support/bin/run');
  return AppRunUtil.run(name);
}

run(process.argv[2]);