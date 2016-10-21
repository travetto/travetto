import * as path from "path";
let glob = require('glob');

export default function (pattern: string, base: string | null = null) {
  let search = `${base || process.cwd()}/${pattern}`;
  //console.log("Bulk Require", search);
  glob.sync(search)
    .map((f: string) => path.resolve(f))
    //.map((x: string) => { console.log(x); return x; })
    .forEach(require)
}