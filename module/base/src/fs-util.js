//@ts-check
const fs = require('fs');
const path = require('path');
const util = require('util');

const FsUtil = {
  reorient: f => f.replace(/[\/]+/, path.sep)
};
for (const k of [
    'readFile', 'writeFile', 'stat', 'lstat', 'unlink', 'readlink', 'realpath',
    'rename', 'open', 'read', 'write', 'readdir', 'exists', 'mkdir'
  ]) {
  FsUtil[`${k}Async`] = util.promisify(fs[k]);
}

module.exports.FsUtil = FsUtil;
FsUtil.mkdirpAsync = async function mkdirpAsync(rel) {
  const pth = FsUtil.reorient(rel);
  if (!(await FsUtil.existsAsync(pth))) {
    try {
      await FsUtil.mkdirAsync(pth);
    } catch (e) {
      await mkdirpAsync(path.dirname(pth));
      await FsUtil.mkdirAsync(pth);
    }
  }
};