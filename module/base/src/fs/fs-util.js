//@ts-check
const fs = require('fs');
const path = require('path');
const util = require('util');
const existsAsync = util.promisify(fs.exists);
const mkdirAsync = util.promisify(fs.mkdir);
const readdirAsync = util.promisify(fs.readdir);
const statAsync = util.promisify(fs.lstat);
const readFileAsync = util.promisify(fs.readFile);
const realpathAsync = util.promisify(fs.realpath);

const All = {
  toURI: rel => rel.replace(/[\/\\]+/g, '/'),
  toNative: rel => rel.replace(/[\/\\]+/g, '/'),
  mkdirpAsync: async function mkdirpAsync(rel) {
    const pth = All.toNative(rel);
    if (pth && !(await existsAsync(pth))) {
      await mkdirpAsync(path.dirname(pth));
      await mkdirAsync(pth);
    }
  },
  resolveNative: (base, rel) => path.resolve(All.toNative(base), All.toNative(rel)),
  resolveURI: (base, rel) => All.toURI(All.resolveNative(base, rel)),
  readdir: dir => readdirAsync(All.toNative(dir)),
  readdirSync: dir => fs.readdirSync(All.toNative(dir)),
  readFile: dir => readFileAsync(All.toNative(dir)),
  readFileSync: dir => fs.readFileSync(All.toNative(dir)),
  stat: file => statAsync(All.toNative(file)),
  statSync: file => fs.lstatSync(All.toNative(file)),
  realpath: file => realpathAsync(All.toNative(file)),
  realpathSync: file => fs.realpathSync(All.toNative(file)),
  watch: (file, ...args) => fs.watch(All.toNative(file), ...args),
  // @ts-ignore
  watchFile: (file, ...args) => fs.watchFile(All.toNative(file), ...args),
  unwatch: (dir, poller) => fs.unwatchFile(dir, poller),
  createReadStream: (file, ...args) => fs.createReadStream(All.toNative(file), ...args)
}


module.exports.FsUtil = All;