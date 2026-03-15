import fs from 'node:fs';
import type { CompilerHost, SourceFile, CompilerOptions, Program, ScriptTarget } from 'typescript';

import { path, ManifestModuleUtil, type ManifestModule, type ManifestRoot, type ManifestIndex, type ManifestModuleFolderType } from '@travetto/manifest';
import type { TransformerManager } from '@travetto/transformer';

import { CompilerUtil } from './util.ts';
import type { CompileStateEntry } from './types.ts';
import { CommonUtil } from './common.ts';
import { tsProxy as ts, tsProxyInit } from './ts-proxy.ts';

const TYPINGS_FOLDER_KEYS = new Set<ManifestModuleFolderType>(['$index', 'support', 'src', '$package']);

export class CompilerState implements CompilerHost {

  static fileExists(location: string): boolean {
    return fs.existsSync(location);
  }

  static async get(idx: ManifestIndex): Promise<CompilerState> {
    return new CompilerState().init(idx);
  }

  /** @private */
  constructor() { }

  #outputPath: string;
  #typingsPath: string;
  #sourceFiles = new Set<string>();
  #sourceDirectory = new Map<string, string>();
  #sourceToEntry = new Map<string, CompileStateEntry>();
  #outputToEntry = new Map<string, CompileStateEntry>();
  #tscOutputFileToOuptut = new Map<string, string>();

  #sourceContents = new Map<string, string | undefined>();
  #sourceFileObjects = new Map<string, SourceFile>();
  #sourceHashes = new Map<string, number>();

  #manifestIndex: ManifestIndex;
  #manifest: ManifestRoot;
  #modules: ManifestModule[];
  #transformerManager: TransformerManager;
  #compilerOptions: CompilerOptions;
  #program: Program;

  #readFile(sourceFile: string): string | undefined {
    const location = this.#sourceToEntry.get(sourceFile)?.sourceFile ?? sourceFile;
    try {
      return ts.sys.readFile(location, 'utf8');
    } catch {
      try { return fs.readFileSync(location, 'utf8'); } catch { }
    }
    return undefined;
  }

  #writeFile(location: string, text: string, bom?: boolean): void {
    try {
      ts.sys.writeFile(location, text, bom);
    } catch {
      fs.mkdirSync(path.dirname(location), { recursive: true });
      fs.writeFileSync(location, text, 'utf8');
    }
  }

  #fileExists(location: string): boolean {
    try {
      return ts.sys.fileExists(location);
    } catch { return fs.existsSync(location); }
  }

  #directoryExists(location: string): boolean {
    try {
      return ts.sys.directoryExists(location);
    } catch { return fs.existsSync(location); }
  }

  #writeExternalTypings(location: string, text: string, bom?: boolean): void {
    let core = location.replace('.map', '');
    if (!this.#outputToEntry.has(core)) {
      core = core.replace(ManifestModuleUtil.TYPINGS_EXT_REGEX, ManifestModuleUtil.OUTPUT_EXT);
    }
    const entry = this.#outputToEntry.get(core);
    if (entry) {
      const relative = this.#manifestIndex.getFromSource(entry.sourceFile)?.relativeFile;
      if (relative && TYPINGS_FOLDER_KEYS.has(ManifestModuleUtil.getFolderKey(relative))) {
        this.#writeFile(location.replace(this.#outputPath, this.#typingsPath), text, bom);
      }
    }
  }

  async #initCompilerOptions(): Promise<CompilerOptions> {
    const tsconfigFile = CommonUtil.resolveWorkspace(this.#manifest, 'tsconfig.json');
    if (!CompilerState.fileExists(tsconfigFile)) {
      this.#writeFile(tsconfigFile, JSON.stringify({ extends: '@travetto/compiler/tsconfig.trv.json' }, null, 2));
    }

    const { options } = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(tsconfigFile, ts.sys.readFile),
      ts.sys,
      this.#manifest.workspace.path
    );

    return {
      ...options,
      noEmit: false,
      allowJs: true,
      sourceRoot: this.#manifest.workspace.path,
      rootDir: this.#manifest.workspace.path,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      module: ts.ModuleKind.ESNext,
      outDir: this.#outputPath
    };
  }

  async init(idx: ManifestIndex): Promise<this> {
    this.#manifestIndex = idx;
    this.#manifest = idx.manifest;
    this.#outputPath = path.resolve(this.#manifest.workspace.path, this.#manifest.build.outputFolder);
    this.#typingsPath = path.resolve(this.#manifest.workspace.path, this.#manifest.build.typesFolder);

    this.#modules = Object.values(this.#manifest.modules);

    // Register all inputs
    for (const module of this.#modules) {
      const base = module?.files ?? {};
      const files = [
        ...base.bin ?? [],
        ...base.src ?? [],
        ...base.support ?? [],
        ...base.doc ?? [],
        ...base.test ?? [],
        ...base.$transformer ?? [],
        ...base.$index ?? [],
        ...base.$package ?? []
      ];
      for (const [file, type] of files) {
        if (ManifestModuleUtil.isSourceType(type)) {
          this.registerInput(module, file);
        }
      }
    }
    return this;
  }

  async initializeTypescript(): Promise<void> {
    await tsProxyInit();
    this.#compilerOptions = await this.#initCompilerOptions();
    const { TransformerManager } = await import('@travetto/transformer');
    this.#transformerManager ??= await TransformerManager.create(this.#manifestIndex);
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
      .filter(module => module.files.src?.length)[0]
      .files.src[0].sourceFile;

    return this.getBySource(randomSource)!.sourceFile;
  }

  async getProgram(force = false): Promise<Program> {
    if (force || !this.#program) {
      await this.initializeTypescript();
      this.#program = ts.createProgram({ rootNames: this.getAllFiles(), host: this, options: this.#compilerOptions, oldProgram: this.#program });
      this.#transformerManager.init(this.#program.getTypeChecker());
      await CommonUtil.queueMacroTask();
    }
    return this.#program;
  }

  async compileSourceFile(sourceFile: string, needsNewProgram = false): Promise<string[] | undefined> {
    const output = this.#sourceToEntry.get(sourceFile)?.outputFile;
    if (!output) {
      return;
    }

    switch (ManifestModuleUtil.getFileType(sourceFile)) {
      case 'js':
      case 'typings':
      case 'package-json': {
        const text = this.readFile(sourceFile)!;
        const finalText = sourceFile.endsWith('package.json') ? CompilerUtil.rewritePackageJSON(this.#manifest, text) : text;
        const location = this.#tscOutputFileToOuptut.get(output) ?? output;
        this.#writeFile(location, finalText, false);
        break;
      }
      case 'ts': {
        const program = await this.getProgram(needsNewProgram);
        const tsSourceFile = program.getSourceFile(sourceFile)!;
        program.emit(
          tsSourceFile,
          (...args) => this.writeFile(args[0], args[1], args[2]), undefined, false,
          this.#transformerManager.get()
        );
        return [
          ...program.getSemanticDiagnostics(tsSourceFile),
          ...program.getSyntacticDiagnostics(tsSourceFile),
          ...program.getDeclarationDiagnostics(tsSourceFile),
        ]
          .filter(d => d.category === ts.DiagnosticCategory.Error)
          .map(diag => {
            let message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
            if (
              message.includes("is not under 'rootDir'")
              || message.includes("does not exist on type 'EnvDataCombinedType'")
              || message.startsWith('Could not find a declaration file for module')
              || message.startsWith("Cannot find module '@travetto")
              || message.startsWith("This JSX tag requires the module path '@travetto")
              || message.startsWith("JSX element implicitly has type 'any'")
            ) {
              return '';
            }
            if (diag.file) {
              const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start!);
              message = `${line + 1}:${character + 1} -- ${message}`;
            }
            return message;
          })
          .filter(Boolean);
      }
    }
  }

  getBySource(sourceFile: string): CompileStateEntry | undefined {
    return this.#sourceToEntry.get(sourceFile);
  }

  isCompilerFile(file: string): boolean {
    const entry = this.getBySource(file);
    return (entry?.moduleFile && ManifestModuleUtil.getFileRole(entry.moduleFile) === 'compile') || entry?.module.roles.includes('compile') || false;
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

    const entry: CompileStateEntry = { sourceFile, outputFile, module, tscOutputFile, import: `${module.name}/${moduleFile}`, moduleFile };

    this.#outputToEntry.set(outputFile, entry);
    this.#sourceFiles.add(sourceFile);
    this.#sourceHashes.set(sourceFile, -1); // Unknown
    this.#sourceToEntry.set(sourceFile, entry);
    this.#sourceDirectory.set(sourceFolder, sourceFolder);

    this.#tscOutputFileToOuptut.set(tscOutputFile, outputFile);
    this.#tscOutputFileToOuptut.set(`${tscOutputFile}.map`, `${outputFile}.map`);

    if (!isTypings) {
      const srcBase = `${ManifestModuleUtil.withoutSourceExtension(tscOutputFile)}${ManifestModuleUtil.TYPINGS_EXT}`;
      const outBase = `${ManifestModuleUtil.withoutSourceExtension(outputFile)}${ManifestModuleUtil.TYPINGS_EXT}`;
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
    const currentHash = CompilerUtil.naiveHash(contents);
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

    const tscOutputDts = `${ManifestModuleUtil.withoutSourceExtension(entry.tscOutputFile)}${ManifestModuleUtil.TYPINGS_EXT}`;
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
  getDefaultLibFileName(options: CompilerOptions): string { return ts.getDefaultLibFileName(options); }
  getNewLine(): string { return ts.sys.newLine; }
  useCaseSensitiveFileNames(): boolean { return ts.sys.useCaseSensitiveFileNames; }
  getDefaultLibLocation(): string { return path.dirname(ts.getDefaultLibFilePath(this.#compilerOptions)); }

  fileExists(sourceFile: string): boolean {
    return this.#sourceToEntry.has(sourceFile) || this.#fileExists(sourceFile);
  }

  directoryExists(sourceDirectory: string): boolean {
    return this.#sourceDirectory.has(sourceDirectory) || this.#directoryExists(sourceDirectory);
  }

  writeFile(outputFile: string, text: string, bom?: boolean): void {
    // JSX runtime shenanigans
    text = text.replace(/support\/jsx-runtime"/g, 'support/jsx-runtime.js"');

    const location = this.#tscOutputFileToOuptut.get(outputFile) ?? outputFile;

    if (ManifestModuleUtil.TYPINGS_WITH_MAP_EXT_REGEX.test(outputFile) || outputFile.endsWith('package.json')) {
      this.#writeExternalTypings(location, text, bom);
    }

    return this.#writeFile(location, text, bom);
  }

  readFile(sourceFile: string): string | undefined {
    const contents = this.#sourceContents.get(sourceFile) ?? this.#readFile(sourceFile);
    this.#sourceContents.set(sourceFile, contents);
    return contents;
  }

  getSourceFile(sourceFile: string, language: ScriptTarget): SourceFile {
    return this.#sourceFileObjects.getOrInsertComputed(sourceFile, () => {
      const content = this.readFile(sourceFile)!;
      return ts.createSourceFile(sourceFile, content ?? '', language);
    });
  }
}