let osTmpdir = require('os-tmpdir');
let tmpDir = path.resolve(osTmpdir());
  
  export function generateTempFile(ext: string): string {
    let now = new Date();
    let name = `image-${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${process.pid}-${(Math.random() * 100000000 + 1).toString(36)}.${ext}`;
    return path.join(tmpDir, name);
  }