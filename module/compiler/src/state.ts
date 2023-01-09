import ts from 'typescript';
import { mkdirSync, readFileSync, writeFile } from 'fs';

import {
  path,
  ManifestModuleUtil, ManifestDelta, ManifestModule,
  ManifestModuleFileType, ManifestRoot, ManifestState
} from '@travetto/manifest';

import { CompilerUtil, FileWatchEvent } from './util';

const validFile = (type: ManifestModuleFileType): boolean => type === 'ts' || type === 'package-json' || type === 'js';

export class CompilerState {

  #inputFiles: Set<string>;
  #relativeInputToSource = new Map<string, { source: string, module: ManifestModule }>();
  #inputToSource = new Map<string, string>();
  #inputToOutput = new Map<string, string | undefined>();
  #inputDirectoryToSource = new Map<string, string>();
  #sourceInputOutput = new Map<string, { input: string, output?: string, relativeInput: string, module: ManifestModule }>();

  #sourceContents = new Map<string, string | undefined>();
  #sourceFileObjects = new Map<string, ts.SourceFile>();
  #sourceHashes = new Map<string, number>();

  #manifest: ManifestRoot;
  #delta: ManifestDelta;
  #modules: ManifestModule[];

  constructor({ manifest, delta }: ManifestState) {
    this.#manifest = manifest;
    this.#delta = delta;
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

    return this;
  }

  registerInput(module: ManifestModule, moduleFile: string): string {
    const relativeInput = `${module.output}/${moduleFile}`;
    const sourceFile = `${module.source}/${moduleFile}`;
    const sourceFolder = path.dirname(sourceFile);
    const inputFile = path.resolve(relativeInput);
    const inputFolder = path.dirname(inputFile);
    const fileType = ManifestModuleUtil.getFileType(moduleFile);
    const outputFile = fileType === 'typings' ?
      undefined :
      path.resolve(
        this.#manifest.workspacePath,
        this.#manifest.outputFolder,
        (fileType === 'ts' ? relativeInput.replace(/[.]ts$/, '.js') : relativeInput)
      );

    this.#inputToSource.set(inputFile, sourceFile);
    this.#sourceInputOutput.set(sourceFile, { input: inputFile, output: outputFile, relativeInput, module });
    this.#inputToOutput.set(inputFile, outputFile);
    this.#inputDirectoryToSource.set(inputFolder, sourceFolder);
    this.#relativeInputToSource.set(relativeInput, { source: sourceFile, module });

    return inputFile;
  }

  removeInput(inputFile: string): void {
    const source = this.#inputToSource.get(inputFile)!;
    const { relativeInput } = this.#sourceInputOutput.get(source)!;
    this.#sourceInputOutput.delete(source);
    this.#inputToSource.delete(inputFile);
    this.#inputToOutput.delete(inputFile);
    this.#relativeInputToSource.delete(relativeInput);
    this.#inputFiles.delete(inputFile);
  }

  resetInputSource(inputFile: string): void {
    this.#sourceFileObjects.delete(inputFile);
    this.#sourceContents.delete(inputFile);
  }

  get manifest(): ManifestRoot {
    return this.#manifest;
  }

  get modules(): ManifestModule[] {
    return this.#modules;
  }

  getDirtyFiles(): string[] {
    if (this.#delta && Object.keys(this.#delta).length) { // If we have any changes
      const files: string[] = [];
      for (const [modName, events] of Object.entries(this.#delta)) {
        const mod = this.#manifest.modules[modName];
        for (const { file } of events) {
          const fileType = ManifestModuleUtil.getFileType(file);
          if (validFile(fileType)) {
            files.push(path.resolve(mod.output, file));
          }
        }
      }
      return files;
    } else {
      return [...this.#inputFiles];
    }
  }

  getDirtyModules(): string[] {
    return [...Object.entries(this.#delta)]
      .filter(x => x[1].length > 0)
      .map(([mod]) => mod);
  }

  getAllFiles(): string[] {
    return [...this.#inputFiles];
  }

  resolveModuleFile(module: string, file: string): string {
    return `${this.modules.find(m => m.name === module)!.source}/${file}`;
  }

  // Build watcher
  getWatcher(handler: {
    create: (inputFile: string) => void;
    update: (inputFile: string) => void;
    delete: (outputFile: string) => void;
  }): (ev: FileWatchEvent, folder: string) => void {
    const mods = Object.fromEntries(this.modules.map(x => [x.source, x]));
    return ({ path: sourceFile, type }: FileWatchEvent, folder: string): void => {
      const mod = mods[folder];
      const moduleFile = sourceFile.replace(`${mod.source}/`, '');
      switch (type) {
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

      // Update manifest on every change
      writeFile(
        path.resolve(
          this.#manifest.workspacePath,
          this.#manifest.outputFolder,
          this.#manifest.manifestFile
        ),
        JSON.stringify(this.#manifest),
        () => { });
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
        mkdirSync(path.dirname(outputFile), { recursive: true });
        if (outputFile.endsWith('package.json')) {
          text = CompilerUtil.rewritePackageJSON(this.manifest, text, options);
        } else if (!options.inlineSourceMap && options.sourceMap && outputFile.endsWith('.map')) {
          text = CompilerUtil.rewriteSourceMap(text, f => this.#relativeInputToSource.get(f));
        } else if (options.inlineSourceMap && CompilerUtil.isSourceMapUrlPosData(data)) {
          text = CompilerUtil.rewriteInlineSourceMap(text, f => this.#relativeInputToSource.get(f), data);
        }
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