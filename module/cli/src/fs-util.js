const fs = require('fs');
const path = require('path');
const os = require('os');
const util = require('util');

const mkdirAsync = util.promisify(fs.mkdir);
const existsAsync = util.promisify(fs.exists);

module.exports.FsUtil = {
  reorient(file) {
    return file.replace(/[\/]+/, path.sep);
  },
  deorient(file) {
    return file.replace(new RegExp(path.sep), '/');
  },
  tempDir(pre) {
    return fs.mkdtempSync(path.resolve(os.tmpdir(), pre));
  },
  isDir(rel) {
    const f = this.reorient(rel);
    return fs.existsSync(f) && fs.lstatSync(f).isDirectory();
  },
  removeAll(files) {
    for (const file of (files || [])) {
      this.remove(file);
    }
  },
  remove(rel) {
    try {
      const pth = this.reorient(rel);
      if (!fs.existsSync(pth)) {
        return;
      }
      if (this.isDir(pth)) {
        for (const f of this.find(pth, undefined, true)) {
          if (this.isDir(f)) {
            fs.rmdirSync(f);
          } else {
            fs.unlinkSync(f);
          }
        }
        fs.rmdirSync(pth);
      } else {
        fs.unlinkSync(pth);
      }
    } catch (e) {
      console.log('Failed to remove', rel, e);
    }
  },
  mkdirp(rel) {
    const pth = this.reorient(rel);
    if (!fs.existsSync(pth)) {
      try {
        fs.mkdirSync(pth);
      } catch (e) {
        this.mkdirp(path.dirname(pth));
        fs.mkdirSync(pth);
      }
    }
  },
  async mkdirpAsync(rel) {
    const pth = this.reorient(rel);
    if (!(await existsAsync(pth))) {
      try {
        await mkdirAsync(pth);
      } catch (e) {
        await this.mkdirpAsync(path.dirname(pth));
        await mkdirASync(pth);
      }
    }
  },
  move(from, to) {
    this.writeFile(to, this.readFile(from));
    this.remove(from);
  },
  writeFile(rel, contents) {
    fs.writeFileSync(this.reorient(rel), contents);
  },
  readFile(rel) {
    return fs.readFileSync(this.reorient(rel)).toString();
  },
  find(pth, test, dirs = false) {
    const list = [];

    pth = this.reorient(pth);

    for (const f of fs.readdirSync(pth)) {
      const subPth = path.resolve(pth, f);
      try {
        if (this.isDir(subPth)) {
          list.push(...this.find(subPth, test, dirs));
          if (dirs && (!test || test(subPth))) {
            list.push(this.deorient(subPth));
          }
        } else if (!test || test(subPth)) {
          list.push(this.deorient(subPth));
        }
      } catch (e) {}
    }
    return list;
  }
};