import * as ts from 'typescript';
import * as sourceMapSupport from 'source-map-support';
import * as fs from 'fs/promises';

import { path, Manifest, Package } from '@travetto/common';

import { WorkspaceManager } from './workspace';
import { ManifestUtil } from './manifest';

const nativeCwd = process.cwd();

const NODE_VERSION = process.env.TRV_NODE_VERSION ?? process.version
  .replace(/^.*?(\d+).*?$/, (_, v) => v);

const TS_TARGET = ({
  12: 'ES2019',
  13: 'ES2019',
  14: 'ES2020',
  15: 'ESNext',
  16: 'ESNext'
} as const)[NODE_VERSION] ?? 'ESNext'; // Default if not found

function isSourceMapUrlPosData(data: unknown): data is { sourceMapUrlPos: number } {
  return data !== undefined && data !== null && typeof data === 'object' && ('sourceMapUrlPos' in data);
}

export type TransformerProvider = {
  init(checker: ts.TypeChecker): void;
  get(): ts.CustomTransformers | undefined;
};

export class Compiler {

  static async main(
    manifestFile: string = process.argv.at(-2)!,
    outDir: string = process.argv.at(-1)!
  ): Promise<void> {
    // Register source maps
    sourceMapSupport.install();

    const state = await ManifestUtil.readState(manifestFile);
    return new this().init(state, outDir).run();
  }

  #sourceFiles: string[];
  #relativeInputToSource: Map<string, { source: string, module: Manifest.Module }>;
  #inputToSource: Map<string, string>;
  #inputDirectoryToSource: Map<string, string>;
  #sourceToOutput: Map<string, { input: string, output?: string }>;
  #bootTsconfig: string;

  #mgr: WorkspaceManager;
  #manifest: Manifest.Root;
  #delta: Manifest.Delta;
  #modules: Manifest.Module[];

  init(
    { manifest, delta }: Manifest.State,
    outputFolder: string
  ): typeof this {
    this.#mgr = new WorkspaceManager(outputFolder);
    this.#manifest = manifest;
    this.#delta = delta;
    this.#modules = Object.values(this.#manifest.modules);
    this.#inputToSource = new Map();
    this.#inputDirectoryToSource = new Map();
    this.#relativeInputToSource = new Map();
    this.#sourceToOutput = new Map();
    this.#sourceFiles = this.#modules.flatMap(
      x => [
        ...x.files.bin ?? [],
        ...x.files.index ?? [],
        ...x.files.src ?? [],
        ...x.files.support ?? [],
        ...x.files.test ?? [],
        ...x.files.rootFiles ?? [],
      ]
        .filter(([file, type]) => type === 'ts' || type === 'd.ts' || (type === 'json' && file === 'package.json') || type === 'js')
        .map(([f]) => {
          const sourceFile = `${x.source}/${f}`;
          const relativeInput = `${x.output}/${f}`;
          const sourceFolder = path.dirname(sourceFile);
          const inputFile = path.resolve(relativeInput);
          const inputFolder = path.dirname(inputFile);

          this.#inputToSource.set(inputFile, sourceFile);
          this.#sourceToOutput.set(sourceFile, {
            input: inputFile,
            output: inputFile.endsWith('.d.ts') ? undefined : path.resolve(outputFolder, relativeInput).replace(/[.]ts$/, '.js')
          });
          this.#inputDirectoryToSource.set(inputFolder, sourceFolder);
          this.#relativeInputToSource.set(relativeInput, { source: sourceFile, module: x });
          return inputFile;
        })
    );

    this.#bootTsconfig = `${this.#modules.find(m => m.name === '@travetto/boot')!.source}/tsconfig.trv.json`;
    return this;
  }

  get workspace(): WorkspaceManager {
    return this.#mgr;
  }

  get manifest(): Manifest.Root {
    return this.#manifest;
  }

  get modules(): Manifest.Module[] {
    return this.#modules;
  }

  /**
   * Read the given tsconfig.json values for the project
   * @param path
   * @returns
   */
  async readTsConfigOptions(file: string): Promise<ts.CompilerOptions> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const { options } = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(file, ts.sys.readFile), ts.sys, nativeCwd
    );
    options.target = ts.ScriptTarget[TS_TARGET];
    return options;
  }

  /**
   * Check transpilation errors
   * @param filename The name of the file
   * @param diagnostics The diagnostic errors
   */
  checkTranspileErrors(filename: string, diagnostics: readonly ts.Diagnostic[]): void {
    if (diagnostics && diagnostics.length) {
      const errors: string[] = diagnostics.slice(0, 5).map(diag => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
        if (diag.file) {
          const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start!);
          return ` @ ${diag.file.fileName.replace(nativeCwd, '.')}(${line + 1}, ${character + 1}): ${message}`;
        } else {
          return ` ${message}`;
        }
      });

      if (diagnostics.length > 5) {
        errors.push(`${diagnostics.length - 5} more ...`);
      }
      throw new Error(`Transpiling ${filename.replace(nativeCwd, '.')} failed: \n${errors.join('\n')}`);
    }
  }


  /**
   * Get loaded compiler options
   */
  async getCompilerOptions(): Promise<ts.CompilerOptions> {
    const opts: Partial<ts.CompilerOptions> = {};
    const rootDir = nativeCwd;
    const projTsconfig = path.resolve('tsconfig.json');
    // Fallback to base tsconfig if not found in local folder
    const config = (await fs.stat(projTsconfig).catch(() => false)) ?
      projTsconfig :
      this.#bootTsconfig;
    console.log('Loading config', config);

    return {
      ...(await this.readTsConfigOptions(config)),
      resolveJsonModule: true,
      allowJs: true,
      outDir: this.#mgr.outDir,
      sourceRoot: rootDir,
      ...opts,
      rootDir,
    };
  }

  #rewriteSourceMap(text: string, sourceMapUrlPos?: number): string {
    if (sourceMapUrlPos) {
      const sourceMapUrl = text.substring(sourceMapUrlPos);
      const [prefix, sourceMapData] = sourceMapUrl.split('base64,');
      const data: { sourceRoot: string, sources: string[] } = JSON.parse(Buffer.from(sourceMapData, 'base64url').toString('utf8'));
      const [src] = data.sources;

      if (src.startsWith('node_modules')) {
        const { source: file, module: resolved } = this.#relativeInputToSource.get(src) ?? {};
        if (file && resolved) {
          data.sourceRoot = resolved.source;
          data.sources = [file];
          text = [
            text.substring(0, sourceMapUrlPos),
            prefix,
            'base64,',
            Buffer.from(JSON.stringify(data), 'utf8').toString('base64url')
          ].join('');
        }
      }
    }
    return text;
  }

  #rewritePackageJSON(pkg: Package): Package {
    if (pkg.files) {
      pkg.files = pkg.files.map(x => x.replace(/[.]ts$/, '.js'));
    }
    if (pkg.main) {
      pkg.main = pkg.main.replace(/[.]ts$/, '.js');
    }
    for (const key of ['devDependencies', 'dependencies', 'peerDependencies'] as const) {
      if (key in pkg) {
        for (const dep of Object.keys(pkg[key] ?? {})) {
          if (dep in this.#manifest.modules) {
            pkg[key]![dep] = this.#manifest.modules[dep].version;
          }
        }
      }
    }
    return pkg;
  }

  /**
   * Create host overlay
   * @param writeFile 
   * @returns 
   */
  getHostPartial(): {
    sys: Partial<ts.System>,
    writeFile: (og: ts.WriteFileCallback, ...rest: Parameters<ts.WriteFileCallback>) => void,
  } {
    return {
      sys: {
        readFile: (file: string): string | undefined => ts.sys.readFile(this.#inputToSource.get(file) ?? file),
        fileExists: (filename: string): boolean => this.#inputToSource.has(filename) || ts.sys.fileExists(filename),
        directoryExists: (folder: string): boolean => this.#inputDirectoryToSource.has(folder) || ts.sys.directoryExists(folder),
        watchFile: (filename: string, ...rest) => ts.sys.watchFile!(this.#inputToSource.get(filename) ?? filename, ...rest),
        watchDirectory: (filename: string, ...rest) => ts.sys.watchDirectory!(this.#inputDirectoryToSource.get(filename) ?? filename, ...rest),
      },
      writeFile: (ogWriteFile: ts.WriteFileCallback, filename: string, text: string, bom, onError, sourceFiles, data?: ts.WriteFileCallbackData): void => {
        if (filename.endsWith('package.json')) {
          const pkg: Package = JSON.parse(text);
          text = JSON.stringify(this.#rewritePackageJSON(pkg), null, 2);
        } else if (isSourceMapUrlPosData(data)) {
          text = this.#rewriteSourceMap(text, data.sourceMapUrlPos);
        }
        ogWriteFile(filename, text, bom, onError, sourceFiles, data);
      }
    }
  }

  /**
   * Build typescript program
   */
  async getProgram(files: Set<string>): Promise<ts.Program> {
    console.debug('Loading program', { size: files.size });
    const options = await this.getCompilerOptions();
    const host = ts.createCompilerHost(options);

    const { writeFile, sys } = this.getHostPartial();
    Object.assign(host, sys);
    host.writeFile = writeFile.bind(null, host.writeFile.bind(host));

    return ts.createProgram({
      rootNames: [...files],
      host,
      options,
    });
  }

  createTransformerProvider?(): Promise<TransformerProvider>;

  outputInit?(): Promise<void>;

  getDirtyFiles(): Set<string> {
    if (this.#delta && Object.keys(this.#delta).length) {
      const files: string[] = [];
      for (const [modName, subs] of Object.entries(this.#delta)) {
        const mod = this.#manifest.modules[modName];
        for (const [file] of subs) {
          files.push(path.resolve(mod.output, file));
        }
      }
      console.log('Changed files', files);
      return new Set(files);
    } else {
      return new Set(this.#sourceFiles);
    }
  }

  getAllFiles(): Set<string> {
    return new Set(this.#sourceFiles);
  }

  /**
   * Compile in a single pass, only emitting dirty files
   */
  async compileOnce(): Promise<void> {
    const files = this.getDirtyFiles();

    const transformers = await this.createTransformerProvider?.();

    // Compile with transformers
    const prog = await this.getProgram(files);

    transformers?.init(prog.getTypeChecker());

    for (const file of files) {
      const result = prog.emit(
        prog.getSourceFile(file),
        undefined,
        undefined,
        false,
        transformers?.get()
      );
      this.checkTranspileErrors(file, result.diagnostics);
    }
  }

  /**
   * Compile everything, in watch mode
   */
  async compileWatch(): Promise<void> {
    const files = this.getAllFiles();

    const { writeFile: ogWriteFile, sys } = this.getHostPartial();

    const watcher = await import('@parcel/watcher');

    const subs: ReturnType<(typeof watcher)['subscribe']>[] = [];
    for (const mod of Object.values(this.manifest.modules).filter(x => x.local)) {
      const sub = watcher.subscribe(mod.source, (err, events) => {
        for (const ev of events) {
          switch (ev.type) {
            case 'delete': {
              const target = this.#sourceToOutput.get(ev.path);
              if (target?.output) {
                fs.unlink(target.output).catch(() => { });
              }
              break;
            }
            case 'create': {
              const input = this.#sourceToOutput.get(ev.path);
              if (input) {

              }
            }
          }
        }
      }, { ignore: ['node_modules', '.trv_out', '.trv_compiler'] });
      subs.push(sub);
    }
    const readiedSubs = await Promise.all(subs);

    const host = ts.createWatchCompilerHost(
      [...files],
      await this.getCompilerOptions(),
      ts.sys,
      ts.createEmitAndSemanticDiagnosticsBuilderProgram,
      dia => {
        const msg = ts.flattenDiagnosticMessageText(dia.messageText, '\n');
        const file = (dia.file ? this.#inputToSource.get(dia.file.fileName) ?? dia.file.fileName : undefined);
        console.error('Error', file, msg)
      },
      dia => console.info(ts.flattenDiagnosticMessageText(dia.messageText, '\n')),
    );

    Object.assign(host, sys);

    const transformers = await this.createTransformerProvider?.();

    const og = host.afterProgramCreate!.bind(host);
    host.afterProgramCreate = (program) => {
      transformers?.init(program.getProgram().getTypeChecker());
      const ogEmit = program.emit.bind(program);
      program.emit = (source, writeFile, cancelToken, emitOnlyDts) =>
        ogEmit(
          source,
          ogWriteFile.bind(null, writeFile ?? ts.sys.writeFile),
          cancelToken,
          emitOnlyDts,
          transformers?.get()
        );
      return og(program);
    };

    // Run
    ts.createWatchProgram(host);

    await new Promise(r => setTimeout(r, 1000 * 60 * 60 * 24));
  }

  isWatching(): boolean {
    return false;
  }

  /**
   * Run the compiler
   */
  async run(): Promise<void> {
    const start = Date.now();

    await this.outputInit?.();

    console.debug('Initialized', { duration: (Date.now() - start) / 1000 });

    if (this.isWatching()) {
      await this.compileWatch();
    } else {
      await this.compileOnce();
    }
  }
}