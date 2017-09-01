import * as fs from 'fs';
import * as ts from 'typescript';
import * as sourcemap from 'source-map-support';
import * as path from 'path';
import * as glob from 'glob';
import * as chokidar from 'chokidar';
import { AppInfo } from './app-info';
import { RetargettingHandler } from './proxy';
import { bulkRequire } from './bulk-find';

const Module = require('module');
const originalLoader = Module._load;
const dataUriRe = /data:application\/json[^,]+base64,/;

export class Compiler {

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
  static modules = new Map<string, { module?: any, proxy?: any, handler?: RetargettingHandler<any> }>();
  static rootFiles: string[] = [];

  static get rootFolders() {
    return AppInfo.ENV.includes('test') ? '{src,test,node_modules/@encore/*/src}' : '{src,node_modules/@encore/*/src}';
  }

  static resolveOptions(name = this.configFile) {
    let out = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(`${this.cwd}/${this.configFile}`, x => ts.sys.readFile(x)), {
        useCaseSensitiveFileNames: true,
        fileExists: ts.sys.fileExists,
        readFile: ts.sys.readFile,
        readDirectory: ts.sys.readDirectory
      }, this.cwd, {
        rootDir: `${this.cwd}`,
        sourceMap: false,
        inlineSourceMap: true,
        outDir: `${this.cwd}`
      }, `${this.cwd}/${this.configFile}`
    );
    out.options.moduleResolution = ts.ModuleResolutionKind.NodeJs;
    return out;
  }

  static resolveTransformers() {
    const transformers: { [key: string]: any } = {};

    // Load transformers
    for (const phase of ['before', 'after']) {
      if (!transformers[phase]) {
        transformers[phase] = [];
      }

      for (let res of bulkRequire(`**/transformer-${phase}*.ts`)) {
        for (const k of Object.keys(res)) {
          transformers[phase].push(res[k]);
        }
      }
    }

    return transformers;
  }

  static moduleLoadHandler(request: string, parent: string) {
    let p = Module._resolveFilename(request, parent);

    let mod = originalLoader.apply(this, arguments);
    let out = mod;

    if (AppInfo.WATCH_MODE && p.indexOf(process.cwd()) >= 0 && p.indexOf('node_modules') < 0) {
      if (!this.modules.has(p)) {
        let handler = new RetargettingHandler(mod);
        out = new Proxy({}, handler);
        this.modules.set(p, { module: out, handler });
      } else {
        const conf = this.modules.get(p)!;
        conf.handler!.target = mod;
        out = conf.module!;
      }
    }

    return out;
  }

  static requireHandler(m: NodeModule, tsf: string) {
    const jsf = tsf.replace(/\.ts$/, '.js');
    let content: string;
    if (!this.contents.has(jsf)) {
      content = this.transpile(fs.readFileSync(tsf).toString(), tsf);
      const map = new Buffer(content.split(dataUriRe)[1], 'base64').toString()
      this.sourceMaps.set(jsf, { content, url: tsf, map });
      this.contents.set(jsf, content);
    } else {
      content = this.contents.get(jsf)!;
    }

    let ret = (m as any)._compile(content, jsf);
    return ret;
  }

  static prepareSourceMaps() {
    sourcemap.install({
      retrieveFile: (p: string) => this.contents.get(p)!,
      retrieveSourceMap: (source: string) => this.sourceMaps.get(source)!
    });

    const compilerLoc = require.resolve('./compiler').split('@encore')[1];
    // Wrap sourcemap tool
    const prep = (Error as any).prepareStackTrace;
    (Error as any).prepareStackTrace = (a: any, stack: any) => {
      const res: string = prep(a, stack);
      const parts = res.split('\n');
      return [parts[0], ...parts.slice(1)
        .filter(l =>
          l.indexOf(compilerLoc) < 0 &&
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
        console.log(this.files.get(fileName)!.version ? 'Reloading' : 'Loading', 'Module', fileName);
        delete require.cache[fileName];
        require(fileName);
      }
    }
  }

  static emitFile(fileName: string) {
    let output = this.services.getEmitOutput(fileName);

    if (this.logErrors(fileName)) {
      console.log(`Emitting ${fileName} failed`);
    }

    if (!output.outputFiles.length) {
      return;
    }

    for (let o of output.outputFiles) {
      this.contents.set(o.name, o.text);
    }

    if (this.files.get(fileName)!.version > 0) {
      this.reload(fileName);
    }
  }

  static watchFiles(fileNames: string[]) {
    let watcher = chokidar.watch(`${this.cwd}/${this.rootFolders}/**/*.ts`, {
      ignored: [/.*\/transformer-.*\.ts$/],
      persistent: true,
      interval: 250,
      ignoreInitial: false
    });

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
    this.prepareSourceMaps();

    this.cwd = cwd;
    let out = this.resolveOptions();

    this.options = out.options;
    this.transformers = this.resolveTransformers();

    require.extensions['.ts'] = this.requireHandler.bind(this);

    if (AppInfo.WATCH_MODE) {
      Module._load = this.moduleLoadHandler.bind(this);
    }

    this.rootFiles = out.fileNames.slice(0);

    this.servicesHost = {
      getScriptFileNames: () => this.rootFiles,
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

    // Prime for type checker
    for (let fileName of this.rootFiles) {
      this.files.set(fileName, { version: 0 });
      this.emitFile(fileName);
    }

    // Now let's watch the files
    if (AppInfo.WATCH_MODE) {
      this.watchFiles(this.rootFiles);
    }
  }
}