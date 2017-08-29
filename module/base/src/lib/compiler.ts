import * as fs from 'fs';
import * as ts from 'typescript';
import * as sourcemap from 'source-map-support';
import * as path from 'path';
import * as glob from 'glob';
import * as chokidar from 'chokidar';

const Module = require('module');
const originalLoader = Module._load;
const dataUriRe = /data:application\/json[^,]+base64,/;
export class Compiler {

  static srcRoot = 'src';
  static configFile = 'tsconfig.json';
  static sourceMaps = new Map<string, { url: string, map: string, content: string }>();
  static files = new Map<string, { version: number }>();
  static contents = new Map<string, string>();
  static servicesHost: ts.LanguageServiceHost;
  static services: ts.LanguageService;
  static cwd: string;
  static options: ts.CompilerOptions;
  static transformers: ts.CustomTransformers;
  static registry: ts.DocumentRegistry;
  static required = new Map<string, { module?: NodeModule, exports?: any }>();
  static debug = false;

  static resolveOptions(name = this.configFile) {
    let out = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(`${this.cwd}/${this.configFile}`, x => ts.sys.readFile(x)), {
        useCaseSensitiveFileNames: true,
        fileExists: ts.sys.fileExists,
        readFile: ts.sys.readFile,
        readDirectory: ts.sys.readDirectory
      }, this.cwd, {
        rootDir: `${this.cwd}/${this.srcRoot}`,
        sourceMap: false,
        inlineSourceMap: true,
        outDir: `${this.cwd}/${this.srcRoot}`
      }, `${this.cwd}/${this.configFile}`
    );
    return out;
  }

  static resolveTransformers() {
    const transformers: { [key: string]: any } = {}
    // Load transformers
    for (const phase of ['before', 'after']) {
      for (const f of glob.sync(`${this.cwd}/**/transformer-${phase}*.ts`)) {
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

  static moduleLoadHandler(request: string, parent: string) {
    let p = Module._resolveFilename(request, parent);
    if (!this.required.has(p)) {
      this.required.set(p, {});
    }
    const req = this.required.get(p)!;

    return originalLoader.apply(this, arguments);
  }

  static requireHandler(m: NodeModule, tsf: string) {
    const jsf = tsf.replace(/\.ts$/, '.js');
    let content: string;
    if (!this.contents.has(jsf)) {
      content = this.transpile(fs.readFileSync(tsf).toString(), tsf);
    } else {
      content = this.contents.get(jsf)!;
    }
    this.required.set(tsf, m);
    const map = new Buffer(content.split(dataUriRe)[1], 'base64').toString()
    this.sourceMaps.set(jsf, { content, url: tsf, map });
    return (m as any)._compile(content, jsf);
  }

  static prepareSourceMaps() {
    sourcemap.install({
      emptyCacheBetweenOperations: this.debug,
      retrieveFile: (p: string) => {
        let content = this.contents.get(p);
        if (!content) {
          content = fs.readFileSync(p).toString();
          this.contents.set(p, content);
        }
        return content;
      },
      retrieveSourceMap: (p: string) => this.sourceMaps.get(p)!,
    });

    // Wrap sourcemap tool
    const prep = (Error as any).prepareStackTrace;
    (Error as any).prepareStackTrace = (a: any, stack: any) => {
      const res: string = prep(a, stack);
      const parts = res.split('\n');
      return [parts[0], ...parts.slice(1)
        .filter(l =>
          l.indexOf(`@encore/base/${this.srcRoot}/lib/this.ts`) < 0 &&
          l.indexOf('module.js') < 0 &&
          l.indexOf('source-map-support.js') < 0 &&
          (l.indexOf('node_modules') > 0 ||
            (l.indexOf('(native)') < 0 && (l.indexOf(this.cwd) < 0 || l.indexOf('.js') < 0))))
      ].join('\n');
    }
  }

  static reload(files: string[] | string) {
    if (!Array.isArray(files)) {
      files = [files];
    }
    for (let fileName of files) {
      if (fileName in require.cache) {
        console.log('Reloading', fileName);
        delete require.cache[fileName];
        require(fileName);
      }
    }
  }

  static emitFile(fileName: string) {
    let output = this.services.getEmitOutput(fileName);

    if (this.logErrors(fileName)) {
      console.log(`Emitting ${fileName} failed`);
      return;
    }

    for (let o of output.outputFiles) {
      this.contents.set(o.name, o.text);
    }

    this.reload(fileName);
  }

  static watchFiles(fileNames: string[]) {
    for (let fileName of fileNames) {
      this.files.set(fileName, { version: 0 });
      this.emitFile(fileName);
    }

    let watcher = chokidar.watch(`${this.cwd}/${this.srcRoot}/**/*.ts`, {
      persistent: true,
      interval: 250,
      ignoreInitial: false
    })

    watcher.on('ready', () => {
      watcher
        .on('add', fileName => {
          fileNames.push(fileName);
          this.files.set(fileName, { version: 0 });
          this.emitFile(fileName);
        })
        .on('change', fileName => {
          this.files.get(fileName)!.version++;
          this.emitFile(fileName)
        });
    });
  }

  static logErrors(fileName: string) {
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

  static transpile(input: string, fileName: string) {
    const output = ts.transpileModule(input, {
      compilerOptions: this.options,
      fileName,
      reportDiagnostics: false,
      transformers: this.transformers
    });
    return output.outputText;
  }

  static init(cwd: string) {
    this.cwd = cwd;
    let out = this.resolveOptions();

    this.options = out.options;
    this.transformers = this.resolveTransformers();
    this.debug = !process.env.PROD;

    require.extensions['.ts'] = this.requireHandler.bind(this);

    if (this.debug) {
      Module._load = this.moduleLoadHandler.bind(this);
    }

    let rootFileNames = out.fileNames.slice(0);

    this.servicesHost = {
      getScriptFileNames: () => rootFileNames,
      getScriptVersion: (fileName) => this.files.has(fileName) ? this.files.get(fileName)!.version.toString() : '',
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
      this.watchFiles(rootFileNames);
    }
  }
}

Compiler.init(process.cwd());