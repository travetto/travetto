var sourcemap = require('source-map-support')
var fs = require('fs');
var path = require('path');
var ts = require('typescript');
var cwd = process.cwd();
var tsOptions = getOptions(path.join(cwd, 'tsconfig.json'));

var dataUriRe = /data:application\/json[^,]+base64,/
var sourceMaps = {};

sourcemap.install({ retrieveSourceMap : function(path) { return sourceMaps[path]; }});

function getOptions(tsconfigFile) {
  var o = require(tsconfigFile).compilerOptions;
  o.target = ts.ScriptTarget[o.target.toUpperCase()];
  o.module = ts.ModuleKind[o.module == 'commonjs' ? 'CommonJS' : o.module.toUpperCase()];
  o.inlineSourceMap = o.sourceMap;
  return o;
}

//Wrap sourcemap tool
var prep = Error.prepareStackTrace;
Error.prepareStackTrace = function(a, stack) {  
  var res = prep(a, stack);
  return res.split('\n').filter(function(l) {
    return l.indexOf('node_modules') > 0 || (l.indexOf('(native)') < 0 && (l.indexOf(cwd)<0 || l.indexOf('.js')<0));
  }).join('\n')
}

require.extensions['.ts'] = function load(m, tsf) {
  var jsf = tsf.replace(/\.ts$/, '.js');
  var parts = tsf.split('/');
  var name = parts.pop();
  var folder = parts.pop();
  var out = ts.transpile(fs.readFileSync(tsf, 'utf-8'), tsOptions, `${folder}/${name}`);
  sourceMaps[jsf] = { content: out, url : tsf, map: new Buffer(out.split(dataUriRe)[1], "base64").toString()}
  return m._compile(out, jsf);
};