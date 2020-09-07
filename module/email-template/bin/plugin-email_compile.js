// Register
require('@travetto/boot/register');
require('@travetto/base').PhaseManager.init().then(() =>
  require('./lib/editor').EditorUtil.init());