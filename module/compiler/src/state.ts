import fs from 'node:fs';

import type { CompilerHost, CompilerOptions, Diagnostic, Program, ScriptTarget, SourceFile } from 'typescript';

import {
  type ManifestIndex,
  type ManifestModule,
  type ManifestModuleFolderType,
  ManifestModuleUtil,
  type ManifestRoot,
  path
} from '@travetto/manifest';
import type { TransformerManager } from '@travetto/transformer';

import { CommonUtil } from './common.ts';
import { tsProxy as ts, tsProxyInit } from './ts-proxy.ts';
import type { CompileStateEntry, CompilerDiagnosticItem } from './types.ts';
import { CompilerUtil } from './util.ts';

const TYPINGS_FOLDER_KEYS = new Set<ManifestModuleFolderType>(['$index', 'support', 'src', '$package']);

export class CompilerState implements CompilerHost {
  static async get(idx: ManifestIndex): Promise<CompilerState> {
    return new CompilerState().init(idx);
  }

  #failures = new Map<string, number>();
  #outputPath: string;
  #typingsPath: string;
  #sourceFiles = new Set<string>();
  #sourceDirectory = new Map<string, string>();
  #sourceToEntry = new Map<string, CompileStateEntry>();
  #outputToEntry = new Map<string, CompileStateEntry>();
  #tscOutputFileToOutput = new Map<string, string>();

  #sourceContents = new Map<string, string | undefined>();
  #sourceFileObjects = new Map<string, SourceFile>();
  #sourceHashes = new Map<string, number>();

  #fileToDependencies = new Map<string, Set<string>>();
  #fileToImporters = new Map<string, Set<string>>();

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
      try {
        return fs.readFileSync(location, 'utf8');
      } catch {}
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
    } catch {
      return fs.existsSync(location);
    }
  }

  #directoryExists(location: string): boolean {
    try {
      return ts.sys.directoryExists(location);
    } catch {
      return fs.existsSync(location);
    }
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
    if (!ts.sys.fileExists(tsconfigFile)) {
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
      outDir: this.#outputPath,
      incremental: true,
      tsBuildInfoFile: path.resolve(this.#outputPath, '.tsbuildinfo')
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
        ...(base.bin ?? []),
        ...(base.src ?? []),
        ...(base.support ?? []),
        ...(base.doc ?? []),
        ...(base.test ?? []),
        ...(base.$transformer ?? []),
        ...(base.$index ?? []),
        ...(base.$package ?? [])
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
    const randomSource = this.#manifestIndex.getWorkspaceModules().filter(module => module.files.src?.length)[0].files.src[0].sourceFile;

    return this.getBySource(randomSource)!.sourceFile;
  }

  async getProgram(force = false): Promise<Program> {
    if (force || !this.#program) {
      await this.initializeTypescript();
      this.#program = ts.createProgram({
        rootNames: this.getAllFiles(),
        host: this,
        options: this.#compilerOptions,
        oldProgram: this.#program
      });
      this.#transformerManager.init(this.#program.getTypeChecker());

      const originalEmit = this.#program.emit.bind(this.#program);
      this.#program.emit = (...arguments_: Parameters<Program['emit']>) => {
        const [targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, customTransformers] = arguments_;
        try {
          return originalEmit(
            targetSourceFile,
            writeFile,
            cancellationToken,
            emitOnlyDtsFiles,
            customTransformers ?? this.#transformerManager.get()
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : `${error}`;
          return {
            emitSkipped: true,
            diagnostics: [
              {
                file: targetSourceFile,
                start: 0,
                length: 1,
                messageText: `Transformer failure: ${message}`,
                category: ts.DiagnosticCategory.Error,
                code: 99999
              }
            ]
          };
        }
      };

      await CommonUtil.queueMacroTask();
    }
    return this.#program;
  }

  #resolveEmittedFilePath(entry: CompileStateEntry, emittedPath: string): { outputLocation: string; typingsLocation?: string } {
    const baseOutput = entry.outputFile.replace(/[.][cm]?js$/, '');
    let outputLocation: string;
    if (emittedPath.endsWith('.d.ts.map')) {
      outputLocation = `${baseOutput}.d.ts.map`;
    } else if (emittedPath.endsWith('.d.ts')) {
      outputLocation = `${baseOutput}.d.ts`;
    } else if (emittedPath.endsWith('.js.map')) {
      outputLocation = `${entry.outputFile}.map`;
    } else {
      outputLocation = entry.outputFile;
    }

    let typingsLocation: string | undefined;
    if (
      ManifestModuleUtil.TYPINGS_WITH_MAP_EXT_REGEX.test(emittedPath) &&
      TYPINGS_FOLDER_KEYS.has(ManifestModuleUtil.getFolderKey(entry.moduleFile))
    ) {
      typingsLocation = outputLocation.replace(this.#outputPath, this.#typingsPath);
    }

    return { outputLocation, typingsLocation };
  }

  #filterDiagnostics(rawDiagnostics: readonly Diagnostic[]): CompilerDiagnosticItem[] {
    const diagnostics: CompilerDiagnosticItem[] = [];
    for (const diagnostic of rawDiagnostics.filter(item => item.category === ts.DiagnosticCategory.Error)) {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      if (
        message.includes("is not under 'rootDir'") ||
        message.includes("does not exist on type 'EnvDataCombinedType'") ||
        message.startsWith('Could not find a declaration file for module') ||
        message.startsWith("Cannot find module '@travetto") ||
        message.startsWith("This JSX tag requires the module path '@travetto") ||
        message.startsWith("JSX element implicitly has type 'any'")
      ) {
        continue;
      }
      let line = 1;
      let column = 1;
      if (diagnostic.file && diagnostic.start !== undefined) {
        const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
        line = position.line + 1;
        column = position.character + 1;
      }
      diagnostics.push({ line, column, message });
    }
    return diagnostics;
  }

  #updateFileDependencies(sourceFile: string, program: Program): void {
    const previousDependencies = this.#fileToDependencies.get(sourceFile);
    if (previousDependencies) {
      for (const dependency of previousDependencies) {
        this.#fileToImporters.get(dependency)?.delete(sourceFile);
      }
    }

    const nextDependencies = new Set<string>();
    const tsSourceFile = program.getSourceFile(sourceFile);
    if (tsSourceFile) {
      for (const statement of tsSourceFile.statements) {
        if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) {
          const specifier = statement.moduleSpecifier;
          if (specifier && ts.isStringLiteral(specifier)) {
            const resolved = ts.resolveModuleName(specifier.text, sourceFile, this.#compilerOptions, this);
            const resolvedFileName = resolved.resolvedModule?.resolvedFileName;
            if (resolvedFileName && this.#sourceToEntry.has(resolvedFileName) && resolvedFileName !== sourceFile) {
              nextDependencies.add(resolvedFileName);
              let importers = this.#fileToImporters.get(resolvedFileName);
              if (!importers) {
                importers = new Set();
                this.#fileToImporters.set(resolvedFileName, importers);
              }
              importers.add(sourceFile);
            }
          }
        }
      }
    }
    this.#fileToDependencies.set(sourceFile, nextDependencies);
  }

  async compileSourceFile(
    sourceFile: string,
    needsNewProgram = false,
    dtsChangeRef?: { changed: boolean }
  ): Promise<CompilerDiagnosticItem[] | undefined> {
    const output = this.#sourceToEntry.get(sourceFile)?.outputFile;
    if (!output) {
      return;
    }

    this.#failures.delete(sourceFile);

    switch (ManifestModuleUtil.getFileType(sourceFile)) {
      case 'package-json': {
        const text = this.readFile(sourceFile)!;
        const finalText = CompilerUtil.rewritePackageJSON(this.#manifest, text);
        this.#writeFile(output, finalText);
        this.#writeExternalTypings(output, finalText);
        break;
      }
      case 'js':
      case 'typings':
        this.writeFile(output, this.readFile(sourceFile)!);
        break;
      case 'ts': {
        const program = await this.getProgram(needsNewProgram);
        const tsSourceFile = program.getSourceFile(sourceFile);
        if (!tsSourceFile) {
          return [];
        }
        program.emit(
          tsSourceFile,
          (fileName, text, writeByteOrderMark) => {
            const entry = this.#sourceToEntry.get(sourceFile);
            if (entry) {
              const { outputLocation, typingsLocation } = this.#resolveEmittedFilePath(entry, fileName);
              if (dtsChangeRef && outputLocation.endsWith('.d.ts')) {
                const previous = this.#readFile(outputLocation);
                if (previous !== text) {
                  dtsChangeRef.changed = true;
                }
              }
              this.#writeFile(outputLocation, text, writeByteOrderMark);
              if (typingsLocation) {
                this.#writeFile(typingsLocation, text, writeByteOrderMark);
              }
            } else {
              this.#writeFile(fileName, text, writeByteOrderMark);
            }
          },
          undefined,
          false,
          this.#transformerManager.get()
        );
        this.#updateFileDependencies(sourceFile, program);
        const rawDiagnostics = [
          ...program.getSemanticDiagnostics(tsSourceFile),
          ...program.getSyntacticDiagnostics(tsSourceFile),
          ...program.getDeclarationDiagnostics(tsSourceFile)
        ];
        const diagnostics = this.#filterDiagnostics(rawDiagnostics);
        if (diagnostics.length) {
          this.#failures.set(sourceFile, diagnostics.length);
          const entry = this.#sourceToEntry.get(sourceFile);
          if (entry && fs.existsSync(entry.outputFile)) {
            try {
              fs.utimesSync(entry.outputFile, 0, 0);
            } catch {}
          }
        }
        return diagnostics;
      }
    }
  }

  async *compileAffectedFiles(
    changedFiles: string[]
  ): AsyncGenerator<{ sourceFile: string; diagnostics: CompilerDiagnosticItem[]; duration: number }> {
    const queue = new Set<string>(changedFiles);
    for (const failedFile of this.#failures.keys()) {
      queue.add(failedFile);
    }

    const processed = new Set<string>();
    let needsNewProgram = true;

    for (const file of queue) {
      if (processed.has(file)) {
        continue;
      }
      processed.add(file);

      const start = Date.now();
      const type = ManifestModuleUtil.getFileType(file);
      if (type !== 'ts') {
        const diagnostics = (await this.compileSourceFile(file)) ?? [];
        yield { sourceFile: file, diagnostics, duration: Date.now() - start };
      } else {
        const dtsChangeRef = { changed: false };
        const diagnostics = (await this.compileSourceFile(file, needsNewProgram, dtsChangeRef)) ?? [];
        needsNewProgram = false;
        yield { sourceFile: file, diagnostics, duration: Date.now() - start };

        if (dtsChangeRef.changed) {
          const importers = this.#fileToImporters.get(file);
          if (importers) {
            for (const importer of importers) {
              if (!processed.has(importer)) {
                queue.add(importer);
              }
            }
          }
        }
      }
    }
  }

  hasErrors(sourceFile?: string): boolean {
    return sourceFile ? this.#failures.has(sourceFile) : this.#failures.size > 0;
  }

  getAllErrors(): [file: string, count: number][] {
    return [...this.#failures.entries()];
  }

  getFailedFiles(): string[] {
    return [...this.#failures.keys()];
  }

  get failureCount(): number {
    return this.#failures.size;
  }

  getBySource(sourceFile: string): CompileStateEntry | undefined {
    return this.#sourceToEntry.get(sourceFile);
  }

  isCompilerFile(file: string): boolean {
    const entry = this.getBySource(file);
    const type = entry ? ManifestModuleUtil.getFolderKey(entry.moduleFile) : undefined;
    return (
      ['src', 'support', 'bin'].includes(type!) &&
      ((entry?.moduleFile && ManifestModuleUtil.getFileRole(entry.moduleFile) === 'compile') ||
        entry?.module.roles.includes('compile') ||
        false)
    );
  }

  registerInput(module: ManifestModule, moduleFile: string): CompileStateEntry {
    const relativeSource = `${module.sourceFolder || '.'}/${moduleFile}`;
    const relativeOutput = `${module.outputFolder}/${moduleFile}`;
    const sourceFile = path.resolve(this.#manifest.workspace.path, relativeSource);
    const sourceFolder = path.dirname(sourceFile);
    const outputFile = path.resolve(this.#outputPath, ManifestModuleUtil.withOutputExtension(relativeOutput));

    const entry: CompileStateEntry = {
      sourceFile,
      outputFile,
      module,
      import: `${module.name}/${moduleFile}`,
      moduleFile
    };

    this.#outputToEntry.set(outputFile, entry);
    this.#sourceFiles.add(sourceFile);
    this.#sourceHashes.set(sourceFile, -1); // Unknown
    this.#sourceToEntry.set(sourceFile, entry);
    this.#sourceDirectory.set(sourceFolder, sourceFolder);

    return entry;
  }

  checkIfSourceChanged(sourceFile: string): boolean {
    const contents = this.#readFile(sourceFile);
    if (contents === undefined) {
      return false;
    }
    const prevHash = this.#sourceHashes.get(sourceFile);
    if (contents.length === 0 && prevHash !== undefined && prevHash >= 0) {
      return false; // Ignore transient empty file on save
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

  resetSourceHash(sourceFile: string): void {
    this.#sourceHashes.delete(sourceFile);
    this.#sourceContents.delete(sourceFile);
    this.#sourceFileObjects.delete(sourceFile);
  }

  /**
   * Remove a source file from compiler tracking and delete its related output files from disk
   */
  removeSource(sourceFile: string): boolean {
    this.#failures.delete(sourceFile);
    const entry = this.#sourceToEntry.get(sourceFile);

    this.#sourceFileObjects.delete(sourceFile);
    this.#sourceContents.delete(sourceFile);
    this.#sourceHashes.delete(sourceFile);
    this.#sourceToEntry.delete(sourceFile);
    this.#sourceFiles.delete(sourceFile);
    if (entry?.outputFile) {
      this.#outputToEntry.delete(entry.outputFile);
    }

    const dependencies = this.#fileToDependencies.get(sourceFile);
    if (dependencies) {
      for (const dependency of dependencies) {
        this.#fileToImporters.get(dependency)?.delete(sourceFile);
      }
      this.#fileToDependencies.delete(sourceFile);
    }
    this.#fileToImporters.delete(sourceFile);

    if (!entry) {
      return false;
    }

    const baseOutput = entry.outputFile.replace(/[.][cm]?js$/, '');
    const outputs = [entry.outputFile, `${entry.outputFile}.map`, `${baseOutput}.d.ts`, `${baseOutput}.d.ts.map`];

    for (const output of outputs) {
      if (fs.existsSync(output)) {
        fs.rmSync(output, { force: true });
      }
      const typingsOutput = output.replace(this.#outputPath, this.#typingsPath);
      if (fs.existsSync(typingsOutput)) {
        fs.rmSync(typingsOutput, { force: true });
      }
    }

    return true;
  }

  getAllFiles(): string[] {
    return [...this.#sourceFiles];
  }

  /* Start Compiler Host */
  getCanonicalFileName(file: string): string {
    return file;
  }
  getCurrentDirectory(): string {
    return this.#manifest.workspace.path;
  }
  getDefaultLibFileName(options: CompilerOptions): string {
    return ts.getDefaultLibFileName(options);
  }
  getNewLine(): string {
    return ts.sys.newLine;
  }
  useCaseSensitiveFileNames(): boolean {
    return ts.sys.useCaseSensitiveFileNames;
  }
  getDefaultLibLocation(): string {
    return path.dirname(ts.getDefaultLibFilePath(this.#compilerOptions));
  }

  realpath(sourceFile: string): string {
    try {
      return path.toPosix(fs.realpathSync(sourceFile));
    } catch {
      return sourceFile;
    }
  }

  fileExists(sourceFile: string): boolean {
    return this.#sourceToEntry.has(sourceFile) || this.#fileExists(sourceFile);
  }

  directoryExists(sourceDirectory: string): boolean {
    return this.#sourceDirectory.has(sourceDirectory) || this.#directoryExists(sourceDirectory);
  }

  writeFile(outputFile: string, text: string, bom?: boolean): void {
    // JSX runtime shenanigans
    text = text.replace(/support\/jsx-runtime"/g, 'support/jsx-runtime.js"');

    if (ManifestModuleUtil.TYPINGS_WITH_MAP_EXT_REGEX.test(outputFile)) {
      this.#writeExternalTypings(outputFile, text, bom);
    }

    this.#writeFile(outputFile, text, bom);
  }

  readFile(sourceFile: string): string | undefined {
    const contents = this.#sourceContents.get(sourceFile) ?? this.#readFile(sourceFile);
    this.#sourceContents.set(sourceFile, contents);
    return contents;
  }

  getSourceFile(sourceFile: string, language: ScriptTarget, onError?: unknown, shouldCreateNewSourceFile?: boolean): SourceFile {
    if (shouldCreateNewSourceFile) {
      this.#sourceFileObjects.delete(sourceFile);
    }
    return this.#sourceFileObjects.getOrInsertComputed(sourceFile, () => {
      const content = this.readFile(sourceFile) ?? '';
      const hash = this.#sourceHashes.get(sourceFile) ?? CompilerUtil.naiveHash(content);
      this.#sourceHashes.set(sourceFile, hash);
      const sourceFileObject = ts.createSourceFile(sourceFile, content, language);
      (sourceFileObject as { version?: string }).version = `${hash}`;
      return sourceFileObject;
    });
  }
}
