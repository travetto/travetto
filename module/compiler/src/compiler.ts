import * as fs from 'fs';
import * as ts from 'typescript';
import * as sourcemap from 'source-map-support';
import * as path from 'path';
import * as glob from 'glob';
import * as chokidar from 'chokidar';
import { EventEmitter } from 'events';

import { bulkRequire, bulkFindSync, AppEnv } from '@encore2/base';
import { RetargettingHandler } from './proxy';

const Module = require('module');
const originalLoader = Module._load.bind(Module);

const dataUriRe = /data:application\/json[^,]+base64,/;

function toJsName(name: string) {
  return name.replace(/\.ts$/, '.js');
}
export class Compiler {

  static configFile = 'tsconfig.json';
  static sourceMaps = new Map<string, { url: string, map: string, content: string }>();
  static files = new Map<string, { version: number }>();
  static contents = new Map<string, string>();
  // static servicesHost: ts.LanguageServiceHost;
  // static langaugeService: ts.LanguageService;
  static cwd: string;
  static options: ts.CompilerOptions;
  static transformers: ts.CustomTransformers;
  static registry: ts.DocumentRegistry;
  static modules = new Map<string, { module?: any, proxy?: any, handler?: RetargettingHandler<any> }>();
  static rootFiles: string[] = [];
  static fileWatcher: fs.FSWatcher;
  static events = new EventEmitter();
  static snaphost = new Map<string, ts.IScriptSnapshot | undefined>()

  static libraryPath = 'node_modules/';
  static frameworkWorkingSet = `${Compiler.libraryPath}/@encore2/*/src/**/*.ts`;
  static prodWorkingSet = 'src/**/*.ts';
  static devWorkingSet = '{src,test}/**/*.ts';
  static workingSet = !AppEnv.prod ? Compiler.devWorkingSet : Compiler.prodWorkingSet;
  static optionalFiles = /\/opt\/[^/]+.ts/;
  static definitionFiles = /\.d\.ts$/g;
  static transformerFiles = '**/transformer.*.ts';
  static emptyRequire = 'module.exports = {}';

  static handleLoadError(p: string, e?: any): boolean {
    if (!AppEnv.prod || this.optionalFiles.test(p)) { // If attempting to load an optional require
      let extra = this.optionalFiles.test(p) ? 'optional ' : '';
      console.error(`Unable to import ${extra}require, ${p}, stubbing out`, e);
      return true;
    } else {
      if (e) {
        throw e;
      } else {
        return false;
      }
    }
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
    out.options.importHelpers = true;
    out.options.noEmitOnError = AppEnv.prod;
    out.options.moduleResolution = ts.ModuleResolutionKind.NodeJs;

    return out;
  }

  static resolveTransformers() {
    const transformers: { [key: string]: any } = {};

    for (let trns of bulkRequire(this.transformerFiles)) {
      for (let { phase, transformer } of Object.values(trns)) {
        if (!transformers[phase]) {
          transformers[phase] = [];
        }
        transformers[phase].push(transformer);
      }
    }
    return transformers;
  }

  static moduleLoadHandler(request: string, parent: string) {

    let mod;
    try {
      mod = originalLoader.apply(null, arguments);
    } catch (e) {
      let p = Module._resolveFilename(request, parent);
      this.handleLoadError(p, e);
      mod = {};
    }

    let out = mod;

    // Proxy modules, if in watch mode for non node_modules paths
    if (AppEnv.watch) {
      let p = Module._resolveFilename(request, parent);
      if (p.indexOf(process.cwd()) >= 0 && p.indexOf(this.libraryPath) < 0) {
        if (!this.modules.has(p)) {
          let handler = new RetargettingHandler(mod);
          out = new Proxy({}, handler);
          this.modules.set(p, { module: out, handler });
          this.events.emit('added', p);
        } else {
          const conf = this.modules.get(p)!;
          conf.handler!.target = mod;
          out = conf.module!;
        }
      }
    }

    return out;
  }

  static time = 0;

  static requireHandler(m: NodeModule, tsf: string) {
    const jsf = toJsName(tsf);

    let content: string;
    if (!this.contents.has(jsf)) {
      // Picking up missed files
      this.rootFiles.push(tsf);
      this.files.set(tsf, { version: 0 });
      this.emitFile(tsf);
    }

    content = this.contents.get(jsf)!;

    try {
      let ret = (m as any)._compile(content, jsf);
      return ret;
    } catch (e) {
      this.handleLoadError(tsf, e);
      this.contents.set(jsf, content = this.emptyRequire);
      (m as any)._compile(content, jsf);
    }
  }

  static prepareSourceMaps() {
    sourcemap.install({
      retrieveFile: (p: string) => this.contents.get(p)!,
      retrieveSourceMap: (source: string) => this.sourceMaps.get(source)!
    });
  }

  static markForReload(files: string[] | string) {
    if (!Array.isArray(files)) {
      files = [files];
    }
    for (let fileName of files) {
      this.unload(fileName);
      // Do not automatically reload
    }
  }

  static unload(fileName: string) {
    console.log('Unloading', fileName);
    if (this.snaphost.has(fileName)) {
      this.snaphost.delete(fileName);
    }
    if (fileName in require.cache) {
      delete require.cache[fileName];
    }
    if (this.modules.has(fileName)) {
      this.modules.get(fileName)!.handler!.target = null;
    }
  }

  static emitFile(fileName: string) {
    //    let output = this.langaugeService.getEmitOutput(fileName);
    let res = this.transpile(ts.sys.readFile(fileName)!, fileName);
    let output = res.outputText;
    if (fileName.match(/\/test\//)) {
      // console.log(fileName, output);
    }
    let outFileName = toJsName(fileName);

    if (this.logErrors(fileName, res.diagnostics)) {
      console.log(`Compiling ${fileName} failed`);
      if (this.handleLoadError(fileName) && this.optionalFiles.test(fileName)) {
        output = this.emptyRequire;
      }
    }
    this.contents.set(outFileName, output);

    if (AppEnv.watch) {
      // If file is already loaded, mark for reload
      if (this.files.get(fileName)!.version > 0) {
        this.markForReload(fileName);
      }
    }
  }

  static watchFiles(fileNames: string[]) {
    let watcher = chokidar.watch(this.workingSet, {
      ignored: [this.transformerFiles, this.optionalFiles],
      persistent: true,
      cwd: process.cwd(),
      interval: 250,
      ignoreInitial: false
    });

    watcher.on('ready', () => {
      watcher
        .on('add', fileName => {
          fileName = `${process.cwd()}/${fileName}`;
          fileNames.push(fileName);
          this.files.set(fileName, { version: 1 });
          this.emitFile(fileName);
          this.events.emit('added', fileName);
        })
        .on('change', fileName => {
          fileName = `${process.cwd()}/${fileName}`;
          let changed = this.files.has(fileName);
          if (changed) {
            this.snaphost.delete(fileName);
            this.files.get(fileName)!.version++;
          } else {
            this.files.set(fileName, { version: 1 });
            fileNames.push(fileName);
          }
          this.emitFile(fileName)
          this.events.emit(changed ? 'changed' : 'added', fileName);
        })
        .on('unlink', fileName => {
          fileName = `${process.cwd()}/${fileName}`;
          this.unload(fileName);
          this.events.emit('removed', fileName);
        });
    });

    return watcher;
  }

  static logErrors(fileName: string, diagnostics?: ts.Diagnostic[]) {
    // let allDiagnostics = this.langaugeService.getCompilerOptionsDiagnostics()
    //   .concat(this.langaugeService.getSyntacticDiagnostics(fileName))
    //   .concat(this.langaugeService.getSemanticDiagnostics(fileName));

    if (!diagnostics || !diagnostics.length) {
      return false;
    }

    for (let diagnostic of diagnostics) {
      let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      if (diagnostic.file) {
        let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start as number);
        console.log(`  Error ${diagnostic.file.fileName}(${line + 1}, ${character + 1}): ${message}`);
      } else {
        console.log(`  Error: ${message}`);
      }
    }

    return diagnostics.length !== 0;
  }

  static transpile(input: string, fileName: string) {
    const output = ts.transpileModule(input, {
      compilerOptions: this.options,
      fileName,
      reportDiagnostics: true,
      transformers: this.transformers
    });
    return output;
  }

  static getSnapshot(fileName: string) {
    if (!this.snaphost.has(fileName)) {
      let snap = fs.existsSync(fileName) ? ts.ScriptSnapshot.fromString(ts.sys.readFile(fileName)!) : undefined
      this.snaphost.set(fileName, snap);
    }
    return this.snaphost.get(fileName);
  }

  static init(cwd: string) {
    let start = Date.now();

    this.prepareSourceMaps();

    this.cwd = cwd;
    let out = this.resolveOptions();

    this.options = out.options;
    this.transformers = this.resolveTransformers();

    require.extensions['.ts'] = this.requireHandler.bind(this);
    Module._load = this.moduleLoadHandler.bind(this);

    this.rootFiles = [
      ...bulkFindSync(this.prodWorkingSet, undefined, p => !p.endsWith('.d.ts')),
      ...bulkFindSync(this.frameworkWorkingSet, undefined, p => !p.endsWith('.d.ts'))
    ];

    console.log('Files', this.rootFiles.length);

    /*
    this.servicesHost = {
      getScriptFileNames: () => this.rootFiles,
      getScriptVersion: (fileName) => this.files.has(fileName) ? this.files.get(fileName)!.version.toString() : '',
      getScriptSnapshot: (fileName) => this.getSnapshot(fileName),
      getCurrentDirectory: () => process.cwd(),
      getCompilationSettings: () => this.options,
      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      directoryExists: ts.sys.directoryExists,
      readDirectory: ts.sys.readDirectory,
      getDirectories: ts.sys.getDirectories,
      getCustomTransformers: () => this.transformers
    };
    */

    // Create the language service files
    // this.langaugeService = ts.createLanguageService(this.servicesHost, this.registry);

    // Prime for type checker
    for (let fileName of this.rootFiles) {
      this.files.set(fileName, { version: 0 });
      this.emitFile(fileName);
    }

    // Now let's watch the files
    if (AppEnv.watch) {
      this.fileWatcher = this.watchFiles(this.rootFiles);
    }

    console.log('Initialized', (Date.now() - start) / 1000);
  }

  static on(event: 'added', callback: (filename: string) => any): void;
  static on(event: 'changed', callback: (filename: string) => any): void;
  static on(event: 'removed', callback: (filename: string) => any): void;
  static on<T>(event: string, callback: (result: T) => any): void {
    this.events.on(event, callback);
  }
}