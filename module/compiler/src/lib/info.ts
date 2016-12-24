import * as fs from 'fs';

let pkg = JSON.parse(fs.readFileSync(process.cwd() + '/package.json').toString());

export let version: string = pkg.version;
export let name: string = pkg.name;
export let simpleName: string = name.replace(/[@]/g, '').replace(/[\/]/g, '_');
export let license: string = pkg.license;
export let author: string = pkg.author;
export let description: string = pkg.description;