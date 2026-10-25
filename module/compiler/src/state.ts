import fs from 'node:fs';

import type { CompilerHost, CompilerOptions, Program, ScriptTarget, SourceFile } from 'typescript';

import {
  type ManifestIndex,
  type ManifestModule,
  ManifestModuleUtil,
  type ManifestRoot,
  path
} from '@travetto/manifest';
import type { TransformerManager } from '@travetto/transformer';

import { CommonUtil } from './common.ts';
import { tsProxy as ts, tsProxyInit } from './ts-proxy.ts';
import type { CompileStateEntry, CompilerDiagnosticItem } from './types.ts';
import { CompilerUtil } from './util.ts';

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

  #sourceContents = new Map<string, string | undefined>();
  #sourceFileObjects = new Map<string, SourceFile>();

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

  #writeFile(location: string, text: string, writeByteOrderMark?: boolean): void {
    try {
      ts.sys.writeFile(location, text, writeByteOrderMark);
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

      await CommonUtil.queueMacroTask();
    }
    return this.#program;
  }

  #resolveEmittedFilePath(entry: CompileStateEntry, emittedPath: string): { outputLocation: string; typingsLocation?: string } {
    return CompilerUtil.resolveEmittedFilePath(entry.outputFile, emittedPath, {
      moduleFile: entry.moduleFile,
      outputPath: this.#outputPath,
      typingsPath: this.#typingsPath
    });
  }

  #writeOutput(
    outputLocation: string,
    text: string,
    writeByteOrderMark?: boolean,
    typingsLocation?: string,
    declarationChange?: { changed: boolean }
  ): void {
    // JSX runtime shenanigans
    text = text.replace(/support\/jsx-runtime"/g, 'support/jsx-runtime.js"');
    if (declarationChange && ManifestModuleUtil.isTypingsFile(outputLocation)) {
      const previous = this.#readFile(outputLocation);
      if (previous !== text) {
        declarationChange.changed = true;
      }
    }
    this.#writeFile(outputLocation, text, writeByteOrderMark);
    if (typingsLocation) {
      this.#writeFile(typingsLocation, text, writeByteOrderMark);
    }
  }

  #updateFileDependencies(sourceFile: string, program?: Program): void {
    const previousDependencies = this.#fileToDependencies.get(sourceFile);
    if (previousDependencies) {
      for (const dependency of previousDependencies) {
        this.#fileToImporters.get(dependency)?.delete(sourceFile);
      }
      this.#fileToDependencies.delete(sourceFile);
    }
    if (!program) {
      this.#fileToImporters.delete(sourceFile);
      return;
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
    declarationChange?: { changed: boolean }
  ): Promise<CompilerDiagnosticItem[] | undefined> {
    const entry = this.#sourceToEntry.get(sourceFile);
    const output = entry?.outputFile;
    if (!output || !entry) {
      return;
    }

    this.#failures.delete(sourceFile);

    switch (ManifestModuleUtil.getFileType(sourceFile)) {
      case 'package-json': {
        const text = this.readFile(sourceFile)!;
        const finalText = CompilerUtil.rewritePackageJSON(this.#manifest, text);
        const typingsLocation = CompilerUtil.isExternalTypings(entry.moduleFile)
          ? output.replace(this.#outputPath, this.#typingsPath)
          : undefined;
        this.#writeOutput(output, finalText, false, typingsLocation);
        break;
      }
      case 'js':
        this.#writeOutput(output, this.readFile(sourceFile)!);
        break;
      case 'typings': {
        const { outputLocation, typingsLocation } = this.#resolveEmittedFilePath(entry, output);
        this.#writeOutput(outputLocation, this.readFile(sourceFile)!, false, typingsLocation, declarationChange);
        break;
      }
      case 'ts': {
        const program = await this.getProgram(needsNewProgram);
        const tsSourceFile = program.getSourceFile(sourceFile)!;
        program.emit(
          tsSourceFile,
          (fileName, text, writeByteOrderMark) => {
            const { outputLocation, typingsLocation } = this.#resolveEmittedFilePath(entry, fileName);
            this.#writeOutput(outputLocation, text, writeByteOrderMark, typingsLocation, declarationChange);
          },
          undefined,
          false,
          this.#transformerManager.get()
        );
        this.#updateFileDependencies(sourceFile, program);
        const diagnostics: CompilerDiagnosticItem[] = [];
        const rawDiagnostics = [
          ...program.getSemanticDiagnostics(tsSourceFile),
          ...program.getSyntacticDiagnostics(tsSourceFile),
          ...program.getDeclarationDiagnostics(tsSourceFile)
        ].filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error);

        for (const diagnostic of rawDiagnostics) {
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
        if (diagnostics.length) {
          this.#failures.set(sourceFile, diagnostics.length);
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
        const declarationChange = { changed: false };
        const diagnostics = (await this.compileSourceFile(file, needsNewProgram, declarationChange)) ?? [];
        needsNewProgram = false;
        yield { sourceFile: file, diagnostics, duration: Date.now() - start };

        if (declarationChange.changed) {
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
    this.#sourceToEntry.set(sourceFile, entry);
    this.#sourceDirectory.set(sourceFolder, sourceFolder);

    return entry;
  }

  checkIfSourceChanged(sourceFile: string): boolean {
    const contents = this.#readFile(sourceFile);
    if (contents === undefined) {
      return false;
    }
    const previousContents = this.#sourceContents.get(sourceFile);
    if (contents.length === 0 && (previousContents?.length ?? 0) > 0) {
      return false; // Ignore transient empty file on save
    }
    const changed = previousContents !== contents;
    if (changed) {
      this.#sourceContents.set(sourceFile, contents);
      this.#sourceFileObjects.delete(sourceFile);
    }
    return changed;
  }

  resetSource(sourceFile: string): void {
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
    this.#sourceToEntry.delete(sourceFile);
    this.#sourceFiles.delete(sourceFile);
    if (entry?.outputFile) {
      this.#outputToEntry.delete(entry.outputFile);
    }

    this.#updateFileDependencies(sourceFile);

    if (!entry) {
      return false;
    }

    const outputs = CompilerUtil.getEmittedOutputs(entry.outputFile);

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

  writeFile(outputFile: string, text: string, writeByteOrderMark?: boolean): void {
    // JSX runtime shenanigans
    text = text.replace(/support\/jsx-runtime"/g, 'support/jsx-runtime.js"');
    this.#writeFile(outputFile, text, writeByteOrderMark);
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
      return ts.createSourceFile(sourceFile, content, language);
    });
  }
}
