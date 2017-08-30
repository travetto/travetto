import * as fs from 'fs';

let pkg = JSON.parse(fs.readFileSync(process.cwd() + '/package.json').toString());

export let VERSION: string = pkg.version;
export let NAME: string = pkg.name;
export let SIMPLE_NAME: string = NAME.replace(/[@]/g, '').replace(/[\/]/g, '_');
export let LICENSE: string = pkg.license;
export let AUTHOR: string = pkg.author;
export let DESCRIPTION: string = pkg.description;
export let DEV_MODE = !!(process.env.DEV || !process.env.PROD);