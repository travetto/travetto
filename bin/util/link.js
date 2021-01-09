const { FsUtil } = require('../../module/boot/src/fs');

// Link register
FsUtil.mkdirpSync('node_modules/@travetto/boot');
FsUtil.symlinkSync(
  FsUtil.resolveUnix('module/boot/register.js'),
  FsUtil.resolveUnix('node_modules/@travetto/boot/register.js')
);

// Link cli
FsUtil.mkdirpSync('.bin');
FsUtil.symlinkSync(
  FsUtil.resolveUnix('module/cli/bin/travetto.js'),
  FsUtil.resolveUnix('.bin/trv')
);