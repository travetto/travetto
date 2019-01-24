//@ts-check
const fs = require('fs');
const path = require('path');

const stdProm = (res, rej) => (err, val) => {
  (err !== undefined && err !== null) ? rej(err) : res(val);
}

const FsUtil = [
  'readFile', 'writeFile', 'stat', 'lstat', 'unlink', 'readlink', 'realpath',
  'rename', 'open', 'read', 'write', 'readdir', 'exists', 'mkdir'
].reduce((acc, k) => {
  acc[`${k}Async`] = (...args) => new Promise((res, rej) =>
    fs[k](...args, k === 'exists' ? res : stdProm(res, rej)));
  return acc;
}, {
    reorient: f => f.replace(/[\/]+/, path.sep)
  });

FsUtil.mkdirpAsync = async function mkdirpAsync(rel) {
  const pth = FsUtil.reorient(rel);
  if (pth && !(await FsUtil.existsAsync(pth))) {
    await mkdirpAsync(path.dirname(pth));
    await FsUtil.mkdirAsync(pth);
  }
};

FsUtil.normalize = function (rel) {
  return rel.replace(/[\/\\]+/g, path.sep);
}

module.exports.FsUtil = FsUtil;