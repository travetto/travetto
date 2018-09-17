//@ts-check
const fs = require('fs');
const path = require('path');
const util = require('util');

const mkdirAsync = util.promisify(fs.mkdir);
const existsAsync = util.promisify(fs.exists);

module.exports.FsUtil = {
  reorient(file) {
    return file.replace(/[\/]+/, path.sep);
  },
  async mkdirpAsync(rel) {
    const pth = this.reorient(rel);
    if (!(await existsAsync(pth))) {
      try {
        await mkdirAsync(pth);
      } catch (e) {
        await this.mkdirpAsync(path.dirname(pth));
        await mkdirAsync(pth);
      }
    }
  }
};