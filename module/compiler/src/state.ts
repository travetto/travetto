import ts from 'typescript';

import { path, ManifestModuleUtil, type ManifestModule, type ManifestRoot, ManifestIndex, ManifestModuleFolderType } from '@travetto/manifest';
import { TransformerManager } from '@travetto/transformer';

import { TypescriptUtil } from '../support/ts-util';

import { CompilerUtil } from './util';
import { CompileEmitError, CompileStateEntry } from './types';
import { CommonUtil } from '../support/util';

const TYPINGS_FOLDER_KEYS = new Set<ManifestModuleFolderType>(['$index', 'support', 'src']);
const TYPINGS_EXT_RE = /[.]d[.][cm]?ts$/;

export class CompilerState implements ts.CompilerHost {

  static async get(idx: ManifestIndex): Promise<CompilerState> {
    return new CompilerState().init(idx);
  }

  private constructor() { }

  #outputPath: string;
  #typingsPath?: string;
  #sourceFiles = new Set<string>();
  #sourceDirectory = new Map<string, string>();
  #sourceToEntry = new Map<string, CompileStateEntry>();
  #outputToEntry = new Map<string, CompileStateEntry>();
  #tscOutputFileToOuptut = new Map<string, string>();

  #sourceContents = new Map<string, string | undefined>();
  #sourceFileObjects = new Map<string, ts.SourceFile>();
  #sourceHashes = new Map<string, number>();

  #manifestIndex: ManifestIndex;
  #manifest: ManifestRoot;
  #modules: ManifestModule[];
  #transformerManager: TransformerManager;
  #compilerOptions: ts.CompilerOptions;
  #program: ts.Program;

  #readFile(sourceFile: string): string | undefined {
    return ts.sys.readFile(this.#sourceToEntry.get(sourceFile)?.sourceFile ?? sourceFile);
  }

  #writeExternalTypings(location: string, text: string, bom: boolean): void {
    if (!this.#typingsPath) {
      return;
    }
    let core = location.replace('.map', '');
    if (!this.#outputToEntry.has(core)) {
      core = core.replace('.d.ts', '.js');
    }
    const entry = this.#outputToEntry.get(core);
    if (entry) {
      const relative = this.#manifestIndex.getFromSource(entry.sourceFile)?.relativeFile;
      if (relative && TYPINGS_FOLDER_KEYS.has(ManifestModuleUtil.getFolderKey(relative))) {
        ts.sys.writeFile(location.replace(this.#outputPath, this.#typingsPath), text, bom);
      }
    }
  }

  async init(idx: ManifestIndex): Promise<this> {
    this.#manifestIndex = idx;
    this.#manifest = idx.manifest;
    this.#outputPath = path.resolve(this.#manifest.workspace.path, this.#manifest.build.outputFolder);


    const baseOptions: ts.CompilerOptions = await TypescriptUtil.getCompilerOptions(this.#manifest);

    this.#compilerOptions = {
      ...baseOptions,
      declarationDir: undefined,
      rootDir: this.#manifest.workspace.path,
      outDir: this.#outputPath
    };

    if (baseOptions.declarationDir) {
      this.#typingsPath = path.resolve(this.#manifest.workspace.path, baseOptions.declarationDir);
    }

    this.#modules = Object.values(this.#manifest.modules);

    // Register all inputs
    for (const x of this.#modules) {
      const base = x?.files ?? {};
      const files = [
        ...base.bin ?? [],
        ...base.src ?? [],
        ...base.support ?? [],
        ...base.doc ?? [],
        ...base.test ?? [],
        ...base.$index ?? [],
        ...base.$package ?? []
      ];
      for (const [file, type] of files) {
        if (CompilerUtil.validFile(type)) {
          this.registerInput(x, file);
        }
      }
    }

    this.#transformerManager = await TransformerManager.create(this.#manifestIndex);

    return this;
  }

  get manifest(): ManifestRoot {
    return this.#manifest;
  }

  get manifestIndex(): ManifestIndex {
    return this.#manifestIndex;
  }

  resolveOutputFile(file: string): string {
    return path.resolve(this.#manifest.workspace.path, this.#manifest.build.outputFolder, file);
  }

  getArbitraryInputFile(): string {
    const randomSource = this.#manifestIndex.getWorkspaceModules()
      .filter(x => x.files.src?.length)[0]
      .files.src[0].sourceFile;

    return this.getBySource(randomSource)!.sourceFile;
  }

  async createProgram(force = false): Promise<ts.Program> {
    if (force || !this.#program) {
      this.#program = ts.createProgram({ rootNames: this.getAllFiles(), host: this, options: this.#compilerOptions, oldProgram: this.#program });
      this.#transformerManager.init(this.#program.getTypeChecker());
      await CommonUtil.queueMacroTask();
    }
    return this.#program;
  }

  async compileSourceFile(sourceFile: string, needsNewProgram = false): Promise<CompileEmitError | undefined> {
    const output = this.#sourceToEntry.get(sourceFile)?.outputFile;
    if (!output) {
      return;
    }

    const program = await this.createProgram(needsNewProgram);
    try {
      switch (ManifestModuleUtil.getFileType(sourceFile)) {
        case 'typings':
        case 'package-json':
          this.writeFile(output, this.readFile(sourceFile)!, false), undefined;
          break;
        case 'js':
          this.writeFile(output, ts.transpile(this.readFile(sourceFile)!, this.#compilerOptions), false);
          break;
        case 'ts': {
          const result = program.emit(
            program.getSourceFile(sourceFile)!,
            (...args) => this.writeFile(...args), undefined, false,
            this.#transformerManager.get()
          );
          return result?.diagnostics?.length ? result.diagnostics : undefined;
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        return err;
      } else {
        throw err;
      }
    }
  }

  getBySource(sourceFile: string): CompileStateEntry | undefined {
    return this.#sourceToEntry.get(sourceFile);
  }

  registerInput(module: ManifestModule, moduleFile: string): CompileStateEntry {
    const relativeSource = `${module.sourceFolder || '.'}/${moduleFile}`;
    const relativeOutput = `${module.outputFolder}/${moduleFile}`;
    const sourceFile = path.resolve(this.#manifest.workspace.path, relativeSource);
    const sourceFolder = path.dirname(sourceFile);
    const fileType = ManifestModuleUtil.getFileType(moduleFile);
    const isTypings = fileType === 'typings';
    const tscOutputFile = path.resolve(this.#outputPath, ManifestModuleUtil.withOutputExtension(relativeSource));
    const outputFile = path.resolve(this.#outputPath, ManifestModuleUtil.withOutputExtension(relativeOutput));

    const entry: CompileStateEntry = { sourceFile, outputFile, module, tscOutputFile };

    this.#outputToEntry.set(outputFile, entry);
    this.#sourceFiles.add(sourceFile);
    this.#sourceHashes.set(sourceFile, -1); // Unknown
    this.#sourceToEntry.set(sourceFile, entry);
    this.#sourceDirectory.set(sourceFolder, sourceFolder);

    this.#tscOutputFileToOuptut.set(tscOutputFile, outputFile);
    this.#tscOutputFileToOuptut.set(`${tscOutputFile}.map`, `${outputFile}.map`);

    if (!isTypings) {
      const srcBase = `${ManifestModuleUtil.withoutSourceExtension(tscOutputFile)}.d.ts`;
      const outBase = `${ManifestModuleUtil.withoutSourceExtension(outputFile)}.d.ts`;
      this.#tscOutputFileToOuptut.set(`${srcBase}.map`, `${outBase}.map`);
      this.#tscOutputFileToOuptut.set(srcBase, outBase);
    }

    return entry;
  }

  checkIfSourceChanged(sourceFile: string): boolean {
    const contents = this.#readFile(sourceFile);
    const prevHash = this.#sourceHashes.get(sourceFile);
    if (!contents || (contents.length === 0 && prevHash)) {
      return false; // Ignore empty file
    }
    const currentHash = CommonUtil.naiveHash(contents);
    const changed = prevHash !== currentHash;
    if (changed) {
      this.#sourceHashes.set(sourceFile, currentHash);
      this.#sourceContents.set(sourceFile, contents);
      this.#sourceFileObjects.delete(sourceFile);
    }
    return changed;
  }

  removeSource(sourceFile: string): void {
    const entry = this.#sourceToEntry.get(sourceFile)!;
    if (entry.outputFile) {
      this.#outputToEntry.delete(entry.outputFile);
    }

    this.#sourceFileObjects.delete(sourceFile);
    this.#sourceContents.delete(sourceFile);
    this.#sourceHashes.delete(sourceFile);
    this.#sourceToEntry.delete(sourceFile);
    this.#sourceFiles.delete(sourceFile);

    const tscOutputDts = `${ManifestModuleUtil.withoutSourceExtension(entry.tscOutputFile)}.d.ts`;
    this.#tscOutputFileToOuptut.delete(entry.tscOutputFile);
    this.#tscOutputFileToOuptut.delete(`${entry.tscOutputFile}.map`);
    this.#tscOutputFileToOuptut.delete(tscOutputDts);
    this.#tscOutputFileToOuptut.delete(`${tscOutputDts}.map`);
  }

  getAllFiles(): string[] {
    return [...this.#sourceFiles];
  }

  /* Start Compiler Host */
  getCanonicalFileName(file: string): string { return file; }
  getCurrentDirectory(): string { return this.#manifest.workspace.path; }
  getDefaultLibFileName(opts: ts.CompilerOptions): string { return ts.getDefaultLibFileName(opts); }
  getNewLine(): string { return ts.sys.newLine; }
  useCaseSensitiveFileNames(): boolean { return ts.sys.useCaseSensitiveFileNames; }
  getDefaultLibLocation(): string { return path.dirname(ts.getDefaultLibFilePath(this.#compilerOptions)); }

  fileExists(sourceFile: string): boolean {
    return this.#sourceToEntry.has(sourceFile) || ts.sys.fileExists(sourceFile);
  }

  directoryExists(sourceDir: string): boolean {
    return this.#sourceDirectory.has(sourceDir) || ts.sys.directoryExists(sourceDir);
  }

  writeFile(
    outputFile: string,
    text: string,
    bom: boolean,
    onError?: (message: string) => void,
    sourceFiles?: readonly ts.SourceFile[],
    data?: ts.WriteFileCallbackData
  ): void {
    if (outputFile.endsWith('package.json')) {
      text = CompilerUtil.rewritePackageJSON(this.#manifest, text);
    }
    const location = this.#tscOutputFileToOuptut.get(outputFile) ?? outputFile;

    if (TYPINGS_EXT_RE.test(outputFile)) {
      this.#writeExternalTypings(location, text, bom);
    }

    ts.sys.writeFile(location, text, bom);
  }

  readFile(sourceFile: string): string | undefined {
    const res = this.#sourceContents.get(sourceFile) ?? this.#readFile(sourceFile);
    this.#sourceContents.set(sourceFile, res);
    return res;
  }

  getSourceFile(sourceFile: string, language: ts.ScriptTarget): ts.SourceFile {
    if (!this.#sourceFileObjects.has(sourceFile)) {
      const content = this.readFile(sourceFile)!;
      this.#sourceFileObjects.set(sourceFile, ts.createSourceFile(sourceFile, content ?? '', language));
    }
    return this.#sourceFileObjects.get(sourceFile)!;
  }
}