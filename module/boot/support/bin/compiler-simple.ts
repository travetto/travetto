import * as sourceMapSupport from 'source-map-support';
import * as ts from 'typescript';
import * as fs from 'fs/promises';
import { mkdirSync, writeFileSync } from 'fs';

import { WorkspaceManager } from './workspace';

import * as path from './path';
import type { Manifest, ManifestDelta, ManifestModule, ManifestState, Package } from './types';
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

export class Compiler {

  #program: ts.Program | undefined;
  #sourceFiles: string[];
  #inverseSourceMap: Map<string, [string, ManifestModule]>;
  #inverseDirectoryMap: Map<string, string>;
  #bootTsconfig: string;

  #mgr: WorkspaceManager;
  #manifest: Manifest;
  #modules: ManifestModule[];

  constructor(
    manifest: Manifest,
    outputFolder: string
  ) {
    this.#mgr = new WorkspaceManager(outputFolder);
    this.#manifest = manifest;
    this.#modules = Object.values(this.#manifest.modules);
    this.#inverseSourceMap = new Map();
    this.#inverseDirectoryMap = new Map();
    this.#sourceFiles = this.#modules.flatMap(
      x => [
        ...x.files.index ?? [],
        ...x.files.src ?? [],
        ...x.files.docIndex ?? [],
        ...x.files.doc ?? [],
        ...x.files.support ?? [],
        ...x.files.test ?? [],
      ]
        .filter(([, type]) => type === 'ts' || type === 'd.ts')
        .map(([f]) => {
          const resolved = path.resolve(`${x.output}/${f}`);
          const target = `${x.source}/${f}`;
          this.#inverseSourceMap.set(resolved, [target, x]);
          this.#inverseDirectoryMap.set(path.dirname(resolved), path.dirname(target));
          return resolved;
        })
    );

    this.#bootTsconfig = `${this.#modules.find(m => m.name === '@travetto/boot')!.source}/tsconfig.trv.json`;
  }

  get workspace() {
    return this.#mgr;
  }

  get manifest() {
    return this.#manifest;
  }

  get modules() {
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
  async #getCompilerOptions(): Promise<ts.CompilerOptions> {
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
      outDir: this.#mgr.outDir,
      sourceRoot: rootDir,
      ...opts,
      rootDir,
    };
  }

  #rewriteSourceMap(text: string, sourceMapUrlPos?: number): string {
    if (sourceMapUrlPos) {
      const sourceMapUrl = text.substring(sourceMapUrlPos);
      const [prefix, sourceMapData] = sourceMapUrl.split(`base64,`)
      const data: { sourceRoot: string, sources: string[] } = JSON.parse(Buffer.from(sourceMapData, 'base64url').toString('utf8'));
      const [src] = data.sources;

      if (src.startsWith('node_modules')) {
        // @ts-expect-error
        const { groups: { mod, file } } = (src.startsWith('node_modules/@') ?
          /^node_modules\/(?<mod>@[^/]+\/[^/]+)\/(?<file>.*)$/ :
          /^node_modules\/(?<mod>[^/]+)\/(?<file>.*)$/
        ).exec(src);
        const resolved = this.#modules.find(x => x.name === mod)!;
        data.sourceRoot = resolved.source;
        data.sources = [file];
        text = text.replace(sourceMapUrl, `${prefix}base64,${Buffer.from(JSON.stringify(data), 'utf8').toString('base64url')}`);
      } else { // Normal file
        const mod = this.#modules.find(x => x.output === '.')!;
        data.sourceRoot = mod.source;
      }

      text = text.replace(sourceMapUrl, `${prefix}base64,${Buffer.from(JSON.stringify(data), 'utf8').toString('base64url')}`);
    }
    return text;
  }

  /**
   * Build typescript program
   */
  async getProgram(files: string[]): Promise<ts.Program> {
    const rootFiles = new Set(files);

    if (!this.#program) {
      console.debug('Loading program', { size: rootFiles.size });
      const options = await this.#getCompilerOptions();
      const host = ts.createCompilerHost(options);
      host.readFile = file => ts.sys.readFile(this.#inverseSourceMap.get(file)?.[0] ?? file);
      host.fileExists = filename => this.#inverseSourceMap.has(filename) || ts.sys.fileExists(filename);
      host.directoryExists = folder => this.#inverseDirectoryMap.has(folder) || ts.sys.directoryExists(folder);
      host.writeFile = (filename: string, text: string, bom, onError, sourceFiles, data?: ts.WriteFileCallbackData) => {
        if (isSourceMapUrlPosData(data)) {
          text = this.#rewriteSourceMap(text, data.sourceMapUrlPos);
        }
        mkdirSync(path.dirname(filename), { recursive: true });
        writeFileSync(filename, text);
      };

      this.#program = ts.createProgram({
        rootNames: [...rootFiles],
        host,
        options,
        oldProgram: this.#program,
      });
    }
    return this.#program!;
  }

  async #initPackages() {
    for (const module of this.#modules) {
      if (module.files.rootFiles?.find(([f]) => f === 'package.json')) {
        const text = (await this.#mgr.readFile(module, 'package.json'));
        const pkg: Package = JSON.parse(text);
        if (pkg.files) {
          pkg.files = pkg.files.map(x => x.replace(/.ts$/, '.js'))
        }
        if (pkg.main) {
          pkg.main = pkg.main.replace(/[.]ts$/, '.js');
        }
        for (const key of ["devDependencies", "dependencies", "peerDependencies"]) {
          if (key in pkg) {
            for (const dep of Object.keys(pkg[key])) {
              if (dep in this.#manifest.modules) {
                pkg[key][dep] = this.#manifest.modules[dep].version;
              }
            }
          }
        }
        this.#mgr.writeFile(module, 'package.json', JSON.stringify(pkg));
      }
    }
  }

  prepareTransformer?(program: ts.Program): void;
  getTransformer?(): ts.CustomTransformers;
  outputInit?(): Promise<void>;

  /**
   * Run the compiler
   */
  async run(delta: ManifestDelta): Promise<void> {
    const start = Date.now();

    await this.#initPackages();

    await this.outputInit?.();

    console.debug('Initialized', { duration: (Date.now() - start) / 1000 });

    let files = this.#sourceFiles;
    if (delta) {
      files = [];
      for (const [modName, subs] of Object.entries(delta)) {
        const mod = this.#manifest.modules[modName];
        for (const [file] of subs) {
          files.push(path.resolve(`${mod.output}/${file}`));
        }
      }
    }

    // Compile with transformers
    const prog = await this.getProgram(files);

    await this.prepareTransformer?.(prog);

    for (const file of files) {
      const result = prog.emit(
        prog.getSourceFile(file),
        undefined,
        undefined,
        false,
        this.getTransformer?.()
      );
      this.checkTranspileErrors(file, result.diagnostics);
    }
  }
}

export async function main<T extends Compiler>(
  Cls: { new(manifest: Manifest, output: string): T },
  manifestFile: string,
  outDir: string,
  transform?: (state: ManifestState) => ManifestState
): Promise<void> {
  // Register source maps
  sourceMapSupport.install();

  let state = await ManifestUtil.readState(manifestFile);

  state = transform?.(state) ?? state;

  return new Cls(state.manifest, outDir).run(state.delta);
}