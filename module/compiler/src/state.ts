import ts from 'typescript';
import { readFileSync } from 'fs';
import fs from 'fs/promises';
import os from 'os';

import { getManifestContext } from '@travetto/manifest/bin/context';
import {
  path, ManifestModuleUtil, ManifestModule, ManifestModuleFileType, ManifestRoot,
  WatchEvent, ManifestUtil, ManifestContext, RootIndex, ManifestModuleFolderType
} from '@travetto/manifest';

import { CompilerUtil } from './util';
import { TranspileUtil } from '../support/transpile';

const validFile = (type: ManifestModuleFileType): boolean => type === 'ts' || type === 'package-json' || type === 'js';
type Entry = { source: string, input: string, relativeInput: string, output?: string, module: ManifestModule };

const FAKE_ROOT = path.resolve(os.tmpdir(), '_');

export class CompilerState {

  #inputFiles: Set<string>;
  #inputDirectoryToSource = new Map<string, string>();
  #inputToEntry = new Map<string, Entry>();
  #sourceToEntry = new Map<string, Entry>();
  #outputToEntry = new Map<string, Entry>();

  #sourceContents = new Map<string, string | undefined>();
  #sourceFileObjects = new Map<string, ts.SourceFile>();
  #sourceHashes = new Map<string, number>();

  #manifest: ManifestRoot;
  #modules: ManifestModule[];
  #transformers: string[];

  #dirtyFiles: { modFolder: string, mod: string, moduleFile?: string, folderKey?: ManifestModuleFolderType, type?: ManifestModuleFileType }[] = [];
  #manifestContexts = new Map<string, ManifestContext>();

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

  get outputPath(): string {
    return path.resolve(this.#manifest.workspacePath, this.#manifest.outputFolder);
  }

  get compilerPidFile(): string {
    return path.resolve(this.outputPath, 'compiler.pid');
  }

  async getCompilerOptions(): Promise<ts.CompilerOptions> {
    return {
      ...await TranspileUtil.getCompilerOptions(this.#manifest),
      rootDir: FAKE_ROOT,
      outDir: this.outputPath
    };
  }

  getInputForSource(sourceFile: string): string {
    return this.#sourceToEntry.get(sourceFile)!.input;
  }

  getOutputForInput(inputFile: string): string {
    return this.#inputToEntry.get(inputFile)!.output!;
  }

  registerInput(module: ManifestModule, moduleFile: string): string {
    const relativeInput = `${module.outputFolder}/${moduleFile}`;
    const sourceFile = path.toPosix(path.resolve(this.#manifest.workspacePath, module.sourceFolder, moduleFile));
    const sourceFolder = path.dirname(sourceFile);
    const inputFile = path.resolve(FAKE_ROOT, relativeInput); // Ensure input is isolated
    const inputFolder = path.dirname(inputFile);
    const fileType = ManifestModuleUtil.getFileType(moduleFile);
    const outputFile = fileType === 'typings' ?
      undefined :
      path.resolve(this.outputPath, CompilerUtil.inputToOutput(relativeInput));

    const entry = { source: sourceFile, input: inputFile, output: outputFile, module, relativeInput };

    this.#inputToEntry.set(inputFile, entry);
    this.#sourceToEntry.set(sourceFile, entry);
    this.#inputDirectoryToSource.set(inputFolder, sourceFolder);

    if (outputFile) {
      this.#outputToEntry.set(outputFile, entry);
    }

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

  get modules(): ManifestModule[] {
    return this.#modules;
  }

  get transformers(): string[] {
    return this.#transformers;
  }

  getAllFiles(): string[] {
    return [...this.#inputFiles];
  }

  async #rebuildManifestsIfNeeded(): Promise<void> {
    if (!this.#dirtyFiles.length) { return; }
    const mods = [...new Set(this.#dirtyFiles.map(x => x.modFolder))];
    const contexts = await Promise.all(mods.map(async folder => {
      if (!this.#manifestContexts.has(folder)) {
        const ctx = await getManifestContext(folder);
        this.#manifestContexts.set(folder, ctx);
      }
      return this.#manifestContexts.get(folder)!;
    }));

    const files = this.#dirtyFiles;
    this.#dirtyFiles = [];

    for (const ctx of [...contexts, this.#manifest]) {
      const manifest = await ManifestUtil.buildManifest(ctx);
      for (const file of files) {
        if (
          file.folderKey && file.moduleFile && file.type &&
          file.mod in manifest.modules && file.folderKey in manifest.modules[file.mod].files
        ) {
          manifest.modules[file.mod].files[file.folderKey]!.push([file.moduleFile, file.type, Date.now()]);
        }
      }
      await ManifestUtil.writeManifest(ctx, manifest);
    }
    // Reindex
    RootIndex.init(RootIndex.manifestFile);
  }

  async reserveWorkspace(): Promise<void> {
    await fs.writeFile(this.compilerPidFile, `${process.pid}`);
  }

  async processOwnsWorkspace(): Promise<boolean> {
    try {
      const pid = await fs.readFile(this.compilerPidFile);
      return +pid !== process.pid;
    } catch {
      return true;
    }
  }

  // Build watcher
  getWatcher(handler: {
    create: (inputFile: string) => void;
    update: (inputFile: string) => void;
    delete: (outputFile: string) => void;
  }): (ev: WatchEvent, folder: string) => void {
    const mods = Object.fromEntries(this.modules.map(x => [path.resolve(this.#manifest.workspacePath, x.sourceFolder), x]));
    return async ({ file: sourceFile, action }: WatchEvent, folder: string): Promise<void> => {
      const mod = mods[folder];
      const moduleFile = sourceFile.includes(mod.sourceFolder) ? sourceFile.split(`${mod.sourceFolder}/`)[1] : sourceFile;
      switch (action) {
        case 'create': {
          const fileType = ManifestModuleUtil.getFileType(moduleFile);
          this.#dirtyFiles.push({
            mod: mod.name,
            modFolder: folder,
            moduleFile,
            folderKey: ManifestModuleUtil.getFolderKey(sourceFile),
            type: ManifestModuleUtil.getFileType(sourceFile)
          });
          if (validFile(fileType)) {
            await this.#rebuildManifestsIfNeeded();

            const hash = CompilerUtil.naiveHash(readFileSync(sourceFile, 'utf8'));
            const input = this.registerInput(mod, moduleFile);
            this.#inputFiles.add(input);
            this.#sourceHashes.set(sourceFile, hash);
            handler.create(input);
          }
          break;
        }
        case 'update': {
          await this.#rebuildManifestsIfNeeded();
          const entry = this.#sourceToEntry.get(sourceFile);
          if (entry) {
            const hash = CompilerUtil.naiveHash(readFileSync(sourceFile, 'utf8'));
            if (this.#sourceHashes.get(sourceFile) !== hash) {
              this.resetInputSource(entry.input);
              this.#sourceHashes.set(sourceFile, hash);
              handler.update(entry.input);
            }
          }
          break;
        }
        case 'delete': {
          const entry = this.#sourceToEntry.get(sourceFile);
          if (entry) {
            this.removeInput(entry.input);
            if (entry.output) {
              this.#dirtyFiles.push({ mod: mod.name, modFolder: folder });
              handler.delete(entry.output);
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
      fileExists: (inputFile: string): boolean => this.#inputToEntry.has(inputFile) || ts.sys.fileExists(inputFile),
      directoryExists: (inputFolder: string): boolean => this.#inputDirectoryToSource.has(inputFolder) || ts.sys.directoryExists(inputFolder),
      readFile: (inputFile: string): string | undefined => {
        const res = this.#sourceContents.get(inputFile) ?? ts.sys.readFile(this.#inputToEntry.get(inputFile)?.source ?? inputFile);
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
          text = CompilerUtil.rewritePackageJSON(this.#manifest, text);
        } else if (!options.inlineSourceMap && options.sourceMap && outputFile.endsWith('.map')) {
          text = CompilerUtil.rewriteSourceMap(this.#manifest, text, f => this.#outputToEntry.get(f.replace(/[.]map$/, ''))!);
        } else if (options.inlineSourceMap && CompilerUtil.isSourceMapUrlPosData(data)) {
          text = CompilerUtil.rewriteInlineSourceMap(this.#manifest, text, f => this.#outputToEntry.get(f)!, data);
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