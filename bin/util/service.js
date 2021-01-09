const { ScanFs } = require('../../module/boot/src/scan');
const { ExecUtil } = require('../../module/boot/src/exec');
const { FsUtil } = require('../../module/boot/src/fs');

const modules = ScanFs.scanDirSync({
  testFile: f => /support\/service[^/]+[.]js$/.test(f)
}, FsUtil.resolveUnix('module'))
  .filter(f => f.stats.isFile())
  .map(x => x.file.replace(/^.*module\/([^/]+).*$/, (a, m) => `@travetto/${m}`))
  .join(',');

ExecUtil.spawn(`trv`, ['command:service', ...process.argv.slice(2)], {
  env: {
    TRV_MODULES: modules
  },
  stdio: [0, 1, 2],
  cwd: FsUtil.resolveUnix('module', 'command')
});