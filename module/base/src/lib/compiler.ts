import * as fs from 'fs';
import * as ts from 'typescript';
import * as sourcemap from 'source-map-support';
import * as path from 'path';
import * as glob from 'glob';

const Module = require('module');
const originalLoader = Module._load;
const dataUriRe = /data:application\/json[^,]+base64,/;

export class Compiler {
  static resolveOptions(cwd: string, name = 'tsconfig.json') {
    let out = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(`${cwd}/tsconfig.json`, x => ts.sys.readFile(x)), {
        useCaseSensitiveFileNames: true,
        fileExists: ts.sys.fileExists,
        readFile: ts.sys.readFile,
        readDirectory: ts.sys.readDirectory
      }, cwd, {
        rootDir: `${cwd}/src`,
        sourceMap: false,
        inlineSourceMap: true,
        outDir: `${cwd}/src`
      }, `${cwd}/tsconfig.json`
    );
    return out;
  }

  static resolveTransformers(cwd: string) {
    const transformers: { [key: string]: any } = {}
    // Load transformers
    for (const phase of ['before', 'after']) {
      for (const f of glob.sync(`${cwd}/**/transformer-${phase}*.ts`)) {
        const res = require(path.resolve(f));
        if (res) {
          if (!transformers[phase]) {
            transformers[phase] = [];
          }
          for (const k of Object.keys(res)) {
            transformers[phase].push(res[k]);
          }
        }
      }
    }
    return transformers;
  }

  sourceMaps: { [key: string]: { url: string, map: string, content: string } } = {};
  files: { [key: string]: { version: number } } = {};
  contents: { [key: string]: string } = {};
  servicesHost: ts.LanguageServiceHost;
  services: ts.LanguageService;
  cwd: string;
  options: ts.CompilerOptions;
  transformers: ts.CustomTransformers;
  registry: ts.DocumentRegistry;
  required = new Map<string, { module?: NodeModule, exports?: any }>();
  debug = false;

  constructor() {
    this.cwd = process.cwd();
    let out = Compiler.resolveOptions(this.cwd);

    this.options = out.options;
    this.transformers = Compiler.resolveTransformers(this.cwd);
    this.debug = !process.env.PROD;

    require.extensions['.ts'] = this.requireHandler.bind(this);

    if (this.debug) {
      Module._load = this.moduleLoadHandler.bind(this);
    }

    this.servicesHost = {
      getScriptFileNames: () => out.fileNames,
      getScriptVersion: (fileName) => this.files[fileName] && this.files[fileName].version.toString(),
      getScriptSnapshot: (fileName) => fs.existsSync(fileName) ? ts.ScriptSnapshot.fromString(fs.readFileSync(fileName).toString()) : undefined,
      getCurrentDirectory: () => process.cwd(),
      getCompilationSettings: () => this.options,
      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      readDirectory: ts.sys.readDirectory,
      getCustomTransformers: () => this.transformers
    };

    // Create the language service files
    this.services = ts.createLanguageService(this.servicesHost, this.registry);

    // Now let's watch the files
    if (this.debug) {
      for (let fileName of out.fileNames) {
        this.watchFile(fileName);
      }
    }
  }

  moduleLoadHandler(request: string, parent: string) {
    let p = Module._resolveFilename(request, parent);
    if (!this.required.has(p)) {
      this.required.set(p, {});
    }
    const req = this.required.get(p)!;

    return originalLoader.apply(this, arguments);
  }

  requireHandler(m: NodeModule, tsf: string) {
    const jsf = tsf.replace(/\.ts$/, '.js');
    let content: string = this.contents[jsf];
    if (!content) {
      content = this.transpile(fs.readFileSync(tsf).toString(), tsf);
    }
    this.required.set(tsf, m);
    const map = new Buffer(content.split(dataUriRe)[1], 'base64').toString()
    this.sourceMaps[jsf] = { content, url: tsf, map };
    return (m as any)._compile(content, jsf);
  }

  prepareSourceMaps() {
    sourcemap.install({
      retrieveSourceMap: (p: string) => this.sourceMaps[p],
    });

    // Wrap sourcemap tool
    const prep = (Error as any).prepareStackTrace;
    (Error as any).prepareStackTrace = (a: any, stack: any) => {
      const res: string = prep(a, stack);
      const parts = res.split('\n');
      return [parts[0], ...parts.slice(1)
        .filter(l =>
          l.indexOf('@encore/base/src/lib/compiler.ts') < 0 &&
          l.indexOf('module.js') < 0 &&
          l.indexOf('source-map-support.js') < 0 &&
          (l.indexOf('node_modules') > 0 ||
            (l.indexOf('(native)') < 0 && (l.indexOf(this.cwd) < 0 || l.indexOf('.js') < 0))))
      ].join('\n');
    }
  }

  watchFile(fileName: string) {
    this.files[fileName] = { version: 0 };

    // First time around, emit all files
    this.emitFile(fileName);

    // Add a watch on the file to handle next change
    fs.watchFile(fileName,
      { persistent: true, interval: 250 },
      (curr, prev) => {
        // Check timestamp
        if (+curr.mtime <= +prev.mtime) {
          return;
        }

        // Update the version to signal a change in the file
        this.files[fileName].version++;

        // write the changes to disk
        this.emitFile(fileName);
      });
  }

  emitFile(fileName: string) {
    let output = this.services.getEmitOutput(fileName);

    if (this.logErrors(fileName)) {
      console.log(`Emitting ${fileName} failed`);
      return;
    }

    for (let o of output.outputFiles) {
      this.contents[o.name] = o.text;
    }

    if (fileName in require.cache) {
      console.log('Reloading', fileName);
      delete require.cache[fileName];
      require(fileName);
    }
  }

  logErrors(fileName: string) {
    let allDiagnostics = this.services.getCompilerOptionsDiagnostics()
      .concat(this.services.getSyntacticDiagnostics(fileName))
      .concat(this.services.getSemanticDiagnostics(fileName));

    if (!allDiagnostics.length) {
      return false;
    }

    for (let diagnostic of allDiagnostics) {
      let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      if (diagnostic.file) {
        let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start as number);
        console.log(`  Error ${diagnostic.file.fileName}(${line + 1}, ${character + 1}): ${message}`);
      } else {
        console.log(`  Error: ${message}`);
      }
    }

    return allDiagnostics.length !== 0;
  }

  transpile(input: string, fileName: string) {
    const output = ts.transpileModule(input, {
      compilerOptions: this.options,
      fileName,
      reportDiagnostics: false,
      transformers: this.transformers
    });
    return output.outputText;
  }
}

new Compiler();