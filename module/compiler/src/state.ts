import ts from 'typescript';
import { readFileSync } from 'fs';

import { path, ManifestModuleUtil, ManifestModule, ManifestModuleFileType, ManifestRoot, ManifestWatchEvent } from '@travetto/manifest';

import { CompilerUtil } from './util';
import { TranspileUtil } from '../support/transpile';

const validFile = (type: ManifestModuleFileType): boolean => type === 'ts' || type === 'package-json' || type === 'js';

export class CompilerState {

  #inputFiles: Set<string>;
  #inputToSource = new Map<string, string>();
  #stagedOutputToOutput = new Map<string, string>();
  #inputToOutput = new Map<string, string | undefined>();
  #inputDirectoryToSource = new Map<string, string>();
  #sourceInputOutput = new Map<string, { source: string, input: string, stagedOutput?: string, output?: string, module: ManifestModule }>();

  #sourceContents = new Map<string, string | undefined>();
  #sourceFileObjects = new Map<string, ts.SourceFile>();
  #sourceHashes = new Map<string, number>();

  #manifest: ManifestRoot;
  #modules: ManifestModule[];
  #transformers: string[];

  constructor(manifest: ManifestRoot) {
    this.#manifest = manifest;
    this.#modules = Object.values(this.#manifest.modules);
    this.#inputFiles = new Set(this.#modules.flatMap(
      x => [
        ...x.files.bin ?? [],
        ...x.files.src ?? [],
        ...x.files.support ?? [],
        ...x.files.doc ?? [],
        ...x.files.test ?? [],
        ...x.files.$index ?? [],
        ...x.files.$package ?? []
      ]
        .filter(([file, type]) => validFile(type) || type === 'typings')
        .map(([f]) => this.registerInput(x, f))
    ));

    this.#transformers = this.#modules.flatMap(
      x => (x.files.$transformer ?? []).map(([f]) =>
        path.resolve(manifest.workspacePath, x.sourceFolder, f)
      )
    );
  }

  async getCompilerOptions(): Promise<ts.CompilerOptions> {
    return {
      ...await TranspileUtil.getCompilerOptions(this.#manifest),
      outDir: this.#manifest.workspacePath, // Force to root
    };
  }

  resolveInput(file: string): string {
    return this.#sourceInputOutput.get(file)!.input;
  }

  registerInput(module: ManifestModule, moduleFile: string): string {
    const relativeInput = `${module.output}/${moduleFile}`;
    const sourceFile = path.toPosix(path.resolve(this.#manifest.workspacePath, module.sourceFolder, moduleFile));
    const sourceFolder = path.dirname(sourceFile);
    const inputFile = path.resolve(this.#manifest.workspacePath, '##', relativeInput); // Ensure input is isolated
    const inputFolder = path.dirname(inputFile);
    const fileType = ManifestModuleUtil.getFileType(moduleFile);
    const outputFile = fileType === 'typings' ?
      undefined :
      path.resolve(
        this.#manifest.workspacePath,
        this.#manifest.outputFolder,
        CompilerUtil.inputToOutput(relativeInput)
      );

    // Rewrite stagedOutput to final output form
    const stagedOutputFile = CompilerUtil.inputToOutput(inputFile);

    this.#inputToSource.set(inputFile, sourceFile);
    this.#sourceInputOutput.set(sourceFile, { source: sourceFile, input: inputFile, stagedOutput: stagedOutputFile, output: outputFile, module });
    this.#inputToOutput.set(inputFile, outputFile);
    this.#inputDirectoryToSource.set(inputFolder, sourceFolder);

    if (stagedOutputFile) {
      this.#stagedOutputToOutput.set(stagedOutputFile, outputFile!);
      this.#stagedOutputToOutput.set(`${stagedOutputFile}.map`, `${outputFile!}.map`);
    }

    return inputFile;
  }

  removeInput(inputFile: string): void {
    const source = this.#inputToSource.get(inputFile)!;
    const { stagedOutput } = this.#sourceInputOutput.get(source)!;
    this.#stagedOutputToOutput.delete(stagedOutput!);
    this.#sourceInputOutput.delete(source);
    this.#inputToSource.delete(inputFile);
    this.#inputToOutput.delete(inputFile);
    this.#inputFiles.delete(inputFile);
  }

  resetInputSource(inputFile: string): void {
    this.#sourceFileObjects.delete(inputFile);
    this.#sourceContents.delete(inputFile);
  }

  get modules(): ManifestModule[] {
    return this.#modules;
  }

  get transformers(): string[] {
    return this.#transformers;
  }

  getAllFiles(): string[] {
    return [...this.#inputFiles];
  }

  // Build watcher
  getWatcher(handler: {
    create: (inputFile: string) => void;
    update: (inputFile: string) => void;
    delete: (outputFile: string) => void;
  }): (ev: ManifestWatchEvent, folder: string) => void {
    const mods = Object.fromEntries(this.modules.map(x => [path.resolve(this.#manifest.workspacePath, x.sourceFolder), x]));
    return ({ file: sourceFile, action }: ManifestWatchEvent, folder: string): void => {
      const mod = mods[folder];
      const moduleFile = sourceFile.includes(mod.sourceFolder) ? sourceFile.split(`${mod.sourceFolder}/`)[1] : sourceFile;
      switch (action) {
        case 'create': {
          const fileType = ManifestModuleUtil.getFileType(moduleFile);
          if (validFile(fileType)) {
            const hash = CompilerUtil.naiveHash(readFileSync(sourceFile, 'utf8'));
            const input = this.registerInput(mod, moduleFile);
            this.#sourceHashes.set(sourceFile, hash);
            handler.create(input);
          }
          break;
        }
        case 'update': {
          const io = this.#sourceInputOutput.get(sourceFile);
          if (io) {
            const hash = CompilerUtil.naiveHash(readFileSync(sourceFile, 'utf8'));
            if (this.#sourceHashes.get(sourceFile) !== hash) {
              this.resetInputSource(io.input);
              this.#sourceHashes.set(sourceFile, hash);
              handler.update(io.input);
            }
          }
          break;
        }
        case 'delete': {
          const io = this.#sourceInputOutput.get(sourceFile);
          if (io) {
            this.removeInput(io.input);
            if (io.output) {
              handler.delete(io.output);
            }
          }
        }
      }
    };
  }

  // ts.CompilerHost
  getCompilerHost(options: ts.CompilerOptions): ts.CompilerHost {
    const host: ts.CompilerHost = {
      getCanonicalFileName: (file: string): string => file,
      getCurrentDirectory: path.cwd,
      getDefaultLibFileName: (opts: ts.CompilerOptions): string => ts.getDefaultLibFileName(opts),
      getNewLine: (): string => ts.sys.newLine,
      useCaseSensitiveFileNames: (): boolean => ts.sys.useCaseSensitiveFileNames,
      getDefaultLibLocation: (): string => path.dirname(ts.getDefaultLibFilePath(options)),
      fileExists: (inputFile: string): boolean => this.#inputToSource.has(inputFile) || ts.sys.fileExists(inputFile),
      directoryExists: (inputFolder: string): boolean => this.#inputDirectoryToSource.has(inputFolder) || ts.sys.directoryExists(inputFolder),
      readFile: (inputFile: string): string | undefined => {
        const res = this.#sourceContents.get(inputFile) ?? ts.sys.readFile(this.#inputToSource.get(inputFile) ?? inputFile);
        this.#sourceContents.set(inputFile, res);
        return res;
      },
      writeFile: (
        outputFile: string,
        text: string,
        bom: boolean,
        onError?: (message: string) => void,
        sourceFiles?: readonly ts.SourceFile[],
        data?: ts.WriteFileCallbackData
      ): void => {
        if (outputFile.endsWith('package.json')) {
          text = CompilerUtil.rewritePackageJSON(this.#manifest, text, options);
        } else if (!options.inlineSourceMap && options.sourceMap && outputFile.endsWith('.map')) {
          text = CompilerUtil.rewriteSourceMap(this.#manifest.workspacePath, text, f => this.#sourceInputOutput.get(this.#inputToSource.get(f)!));
        } else if (options.inlineSourceMap && CompilerUtil.isSourceMapUrlPosData(data)) {
          text = CompilerUtil.rewriteInlineSourceMap(this.#manifest.workspacePath, text, f => this.#sourceInputOutput.get(this.#inputToSource.get(f)!), data);
        }
        outputFile = this.#stagedOutputToOutput.get(outputFile) ?? outputFile;
        ts.sys.writeFile(outputFile, text, bom);
      },
      getSourceFile: (inputFile: string, language: ts.ScriptTarget, __onErr?: unknown): ts.SourceFile => {
        if (!this.#sourceFileObjects.has(inputFile)) {
          const content = host.readFile(inputFile)!;
          this.#sourceFileObjects.set(inputFile, ts.createSourceFile(inputFile, content ?? '', language));
        }
        return this.#sourceFileObjects.get(inputFile)!;
      }
    };
    return host;
  }
}