let pkg = JSON.parse(fs.readFileSync(process.cwd() + '/package.json').toString());
let simpleName = pkg.name.replace(/[@]/g, '').replace(/[\/]/g, '_');

module.exports = {
  version: pkg.version,
  name: pkg.name,
  simpleName,
  license: pkg.license,
  author: pkg.author,
  description: pkg.author,
}