//@ts-check
const fs = require('fs');
const path = require('path');
const util = require('util');
const os = require('os');
const existsAsync = util.promisify(fs.exists);
const mkdirAsync = util.promisify(fs.mkdir);
const readdirAsync = util.promisify(fs.readdir);
const statAsync = util.promisify(fs.lstat);
const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);
const realpathAsync = util.promisify(fs.realpath);
const unlinkAsync = util.promisify(fs.unlink);
const renameAsync = util.promisify(fs.rename);
const openAsync = util.promisify(fs.open);
const readAsync = util.promisify(fs.read);
const mkdtempAsync = util.promisify(fs.mkdtemp);

const asFile = rel => rel.replace(/[\/\\]+/g, '/');


const All = {
  toURI: rel => rel.replace(/[\/\\]+/g, '/'),
  toNative: asFile,
  basename: rel => path.basename(All.toNative(rel)),
  extname: rel => path.extname(All.toNative(rel)),
  dirname: rel => path.dirname(All.toNative(rel)),

  mkdirpAsync: async function mkdirpAsync(rel) {
    const pth = asFile(rel);
    if (pth && !(await existsAsync(pth))) {
      await mkdirpAsync(path.dirname(pth));
      await mkdirAsync(pth);
    }
  },
  exists: (file) => existsAsync(asFile(file)),
  existsSync: (file) => fs.existsSync(asFile(file)),
  resolveNative: (base, ...rel) => path.resolve(asFile(base), ...rel.map(asFile)),
  resolveURI: (base, ...rel) => All.toURI(All.resolveNative(base, ...rel)),
  readdir: dir => readdirAsync(asFile(dir)),
  readdirSync: dir => fs.readdirSync(asFile(dir)),
  readFile: (dir, ...args) => readFileAsync(asFile(dir), ...args),
  readFileSync: (dir, ...args) => fs.readFileSync(asFile(dir), ...args),
  //@ts-ignore
  writeFile: (dir, ...args) => writeFileAsync(asFile(dir), ...args),
  //@ts-ignore
  writeFileSync: (dir, ...args) => fs.writeFileSync(asFile(dir), ...args),
  stat: file => statAsync(asFile(file)),
  statSync: file => fs.lstatSync(asFile(file)),
  realpath: file => realpathAsync(asFile(file)),
  realpathSync: file => fs.realpathSync(asFile(file)),
  watch: (file, ...args) => fs.watch(asFile(file), ...args),
  // @ts-ignore
  watchFile: (file, ...args) => fs.watchFile(asFile(file), ...args),
  unwatch: (dir, poller) => fs.unwatchFile(dir, poller),
  createReadStream: (file, ...args) => fs.createReadStream(asFile(file), ...args),
  createWriteStream: (file, ...args) => fs.createWriteStream(asFile(file), ...args),
  unlink: (file) => unlinkAsync(asFile(file)),
  unlinkSync: (file) => fs.unlinkSync(asFile(file)),
  rename: (file, to) => renameAsync(asFile(file), asFile(to)),
  renameSync: (file, to) => fs.renameSync(asFile(file), asFile(to)),
  // @ts-ignore
  open: (file, ...args) => openAsync(asFile(file), ...args),
  // @ts-ignore
  read: (...args) => readAsync(...args),
  mkdtemp: (file, ...args) => mkdtempAsync(asFile(file), ...args),
  mkdtempSync: (file, ...args) => fs.mkdtempSync(asFile(file), ...args)
};

All.tmpdir = All.toURI(os.tmpdir());

module.exports.FsUtil = All;