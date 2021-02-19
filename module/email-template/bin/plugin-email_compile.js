// Register
require('@travetto/boot/register');
require('@travetto/base').PhaseManager.run('init').then(() =>
  require('./lib/editor').EditorUtil.init());