import ts from 'typescript';

import { path, ManifestModuleUtil, ManifestModule, ManifestRoot, ManifestIndex } from '@travetto/manifest';
import { TransformerManager } from '@travetto/transformer';

import { CompilerUtil } from './util';
import { TranspileUtil } from '../support/transpile';
import { CompileStateEntry } from './types';

function folderMapper(root: string, prefix: string): { dir: string, translate: (val: string) => string } {
  let matched: string = '~~';
  prefix = `/${prefix}`;
  const final = path.resolve(root).replace(/\/[^\/]+/, m => {
    matched = m;
    return prefix;
  });
  return { dir: final, translate: (file: string) => file.replace(prefix, matched) };
}

export class CompilerState implements ts.CompilerHost {

  static async get(idx: ManifestIndex): Promise<CompilerState> {
    return new CompilerState().init(idx);
  }

  private constructor() { }

  #rootDir: string;
  #inputPathToSource: (file: string) => string;
  #outputPath: string;
  #inputFiles = new Set<string>();
  #inputDirectoryToSource = new Map<string, string>();
  #inputToEntry = new Map<string, CompileStateEntry>();
  #sourceToEntry = new Map<string, CompileStateEntry>();
  #outputToEntry = new Map<string, CompileStateEntry>();

  #sourceContents = new Map<string, string | undefined>();
  #sourceFileObjects = new Map<string, ts.SourceFile>();

  #manifestIndex: ManifestIndex;
  #manifest: ManifestRoot;
  #modules: ManifestModule[];
  #transformerManager: TransformerManager;
  #compilerOptions: ts.CompilerOptions;

  async init(idx: ManifestIndex): Promise<this> {
    this.#manifestIndex = idx;
    this.#manifest = idx.manifest;
    const mapper = folderMapper(this.#manifest.workspacePath, '##');
    this.#rootDir = mapper.dir;
    this.#inputPathToSource = mapper.translate;

    this.#outputPath = path.resolve(this.#manifest.workspacePath, this.#manifest.outputFolder);
    this.#modules = Object.values(this.#manifest.modules);

    // Register all inputs
    for (const x of this.#modules) {
      const files = [
        ...x.files.bin ?? [],
        ...x.files.src ?? [],
        ...x.files.support ?? [],
        ...x.files.doc ?? [],
        ...x.files.test ?? [],
        ...x.files.$index ?? [],
        ...x.files.$package ?? []
      ];
      for (const [file, type] of files) {
        if (CompilerUtil.validFile(type) || type === 'typings') {
          this.registerInput(x, file);
        }
      }
    }

    this.#transformerManager = await TransformerManager.create(this.#manifestIndex);

    this.#compilerOptions = {
      ...await TranspileUtil.getCompilerOptions(this.#manifest),
      rootDir: this.#rootDir,
      outDir: this.#outputPath
    };

    return this;
  }

  get manifest(): ManifestRoot {
    return this.#manifest;
  }

  get manifestIndex(): ManifestIndex {
    return this.#manifestIndex;
  }

  resolveOutputFile(file: string): string {
    return path.resolve(this.#manifest.workspacePath, this.#manifest.outputFolder, file);
  }

  getArbitraryInputFile(): string {
    return this.getBySource(this.#manifestIndex.getModule('@travetto/manifest')!.files.src[0].sourceFile)!.input;
  }

  createProgram(oldProgram?: ts.Program): ts.Program {
    const prog = ts.createProgram({ rootNames: this.getAllFiles(), host: this, options: this.#compilerOptions, oldProgram });
    this.#transformerManager.init(prog.getTypeChecker());
    return prog;
  }

  writeInputFile(program: ts.Program, inputFile: string): ts.EmitResult | undefined | void {
    switch (ManifestModuleUtil.getFileType(inputFile)) {
      case 'package-json':
        return this.writeFile(this.#inputToEntry.get(inputFile)!.output!, this.readFile(inputFile)!, false);
      case 'js':
        return this.writeFile(this.#inputToEntry.get(inputFile)!.output!, ts.transpile(this.readFile(inputFile)!, this.#compilerOptions), false);
      case 'ts':
        return program.emit(
          program.getSourceFile(inputFile)!,
          (...args) => this.writeFile(...args), undefined, false,
          this.#transformerManager.get()
        );
    }
  }

  getBySource(sourceFile: string): CompileStateEntry | undefined {
    return this.#sourceToEntry.get(sourceFile);
  }

  registerInput(module: ManifestModule, moduleFile: string): string {
    const relativeInput = `${module.outputFolder}/${moduleFile}`;
    const sourceFile = path.resolve(this.#manifest.workspacePath, module.sourceFolder, moduleFile);
    const sourceFolder = path.dirname(sourceFile);
    const inputFile = path.resolve(this.#rootDir, relativeInput); // Ensure input is isolated
    const inputFolder = path.dirname(inputFile);
    const fileType = ManifestModuleUtil.getFileType(moduleFile);
    const outputFile = fileType === 'typings' ?
      undefined :
      path.resolve(this.#outputPath, ManifestModuleUtil.sourceToOutputExt(relativeInput));

    const entry = { source: sourceFile, input: inputFile, output: outputFile, module, relativeInput };

    this.#inputToEntry.set(inputFile, entry);
    this.#sourceToEntry.set(sourceFile, entry);
    this.#inputDirectoryToSource.set(inputFolder, sourceFolder);

    if (outputFile) {
      this.#outputToEntry.set(outputFile, entry);
    }

    this.#inputFiles.add(inputFile);

    return inputFile;
  }

  removeInput(inputFile: string): void {
    const { output, source } = this.#inputToEntry.get(inputFile)!;
    if (output) {
      this.#outputToEntry.delete(output);
    }
    this.#sourceToEntry.delete(source);
    this.#inputToEntry.delete(inputFile);
    this.#inputFiles.delete(inputFile);
  }

  resetInputSource(inputFile: string): void {
    this.#sourceFileObjects.delete(inputFile);
    this.#sourceContents.delete(inputFile);
  }

  getAllFiles(): string[] {
    return [...this.#inputFiles];
  }

  /* Start Compiler Host */
  getCanonicalFileName(file: string): string { return file; }
  getCurrentDirectory(): string { return this.#rootDir; }
  getDefaultLibFileName(opts: ts.CompilerOptions): string { return ts.getDefaultLibFileName(opts); }
  getNewLine(): string { return ts.sys.newLine; }
  useCaseSensitiveFileNames(): boolean { return ts.sys.useCaseSensitiveFileNames; }
  getDefaultLibLocation(): string { return path.dirname(ts.getDefaultLibFilePath(this.#compilerOptions)); }

  fileExists(inputFile: string): boolean {
    return this.#inputToEntry.has(inputFile) || ts.sys.fileExists(this.#inputPathToSource(inputFile));
  }

  directoryExists(inputDir: string): boolean {
    return this.#inputDirectoryToSource.has(inputDir) || ts.sys.directoryExists(this.#inputPathToSource(inputDir));
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
    } else if (!this.#compilerOptions.inlineSourceMap && this.#compilerOptions.sourceMap && outputFile.endsWith('.map')) {
      text = CompilerUtil.rewriteSourceMap(this.#manifest, text, f => this.#outputToEntry.get(f.replace(/[.]map$/, ''))!);
    } else if (this.#compilerOptions.inlineSourceMap && CompilerUtil.isSourceMapUrlPosData(data)) {
      text = CompilerUtil.rewriteInlineSourceMap(this.#manifest, text, f => this.#outputToEntry.get(f)!, data);
    }
    ts.sys.writeFile(outputFile, text, bom);
  }

  readFile(inputFile: string): string | undefined {
    const res = this.#sourceContents.get(inputFile) ?? ts.sys.readFile(
      this.#inputToEntry.get(inputFile)?.source ?? this.#inputPathToSource(inputFile)
    );
    this.#sourceContents.set(inputFile, res);
    return res;
  }

  getSourceFile(inputFile: string, language: ts.ScriptTarget): ts.SourceFile {
    if (!this.#sourceFileObjects.has(inputFile)) {
      const content = this.readFile(inputFile)!;
      this.#sourceFileObjects.set(inputFile, ts.createSourceFile(inputFile, content ?? '', language));
    }
    return this.#sourceFileObjects.get(inputFile)!;
  }
}