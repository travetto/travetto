const { FsUtil } = require('../../module/boot/src/fs');
const { ScanFs } = require('../../module/boot/src/scan');

// Clean
ScanFs.scanDirSync({
  testDir: x =>
    !/(node_modules|[.]trv_cache)/.test(x) ||
    /([.]trv_cache[^/]+|node_modules)$/.test(x)
}, FsUtil.resolveUnix('module'))
  .filter(x => x.stats.isDirectory() &&
    /([.]trv_cache[^/]+|node_modules)$/.test(x.file)
  )
  .map(x => FsUtil.unlinkRecursiveSync(x.file));